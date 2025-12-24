"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  User,
  MapPin,
  Camera,
  AlertCircle,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface KYCStatus {
  status: string;
  level: string;
  steps: {
    identity: { completed: boolean; status: string };
    address: { completed: boolean; status: string };
    selfie: { completed: boolean; status: string };
  };
  verification?: {
    id: string;
    status: string;
    submittedAt: string;
    notes?: string;
  };
}

const stepIcons = {
  identity: User,
  address: MapPin,
  selfie: Camera,
};

const stepLabels = {
  identity: "Identity Document",
  address: "Address Verification",
  selfie: "Selfie Verification",
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  APPROVED: { label: "Verified", color: "text-green-600", icon: CheckCircle },
  PENDING: { label: "Pending Review", color: "text-yellow-600", icon: Clock },
  REJECTED: { label: "Rejected", color: "text-red-600", icon: XCircle },
  NOT_STARTED: { label: "Not Started", color: "text-gray-400", icon: Clock },
};

interface UploadedFile {
  file: File;
  preview: string;
  url?: string;
}

export default function KYCPage() {
  const { toast } = useToast();
  const [kycData, setKycData] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeStep, setActiveStep] = useState<"identity" | "address" | "selfie" | null>(null);

  // File input refs
  const documentFrontRef = useRef<HTMLInputElement>(null);
  const documentBackRef = useRef<HTMLInputElement>(null);
  const addressProofRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  // Form states
  const [idType, setIdType] = useState("passport");
  const [idNumber, setIdNumber] = useState("");
  const [idCountry, setIdCountry] = useState("US");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostal, setAddressPostal] = useState("");
  const [addressCountry, setAddressCountry] = useState("US");

  // File states
  const [documentFront, setDocumentFront] = useState<UploadedFile | null>(null);
  const [documentBack, setDocumentBack] = useState<UploadedFile | null>(null);
  const [addressProof, setAddressProof] = useState<UploadedFile | null>(null);
  const [selfieImage, setSelfieImage] = useState<UploadedFile | null>(null);

  const fetchKycStatus = async () => {
    try {
      const response = await fetch("/api/kyc");
      if (!response.ok) throw new Error("Failed to fetch KYC status");
      const data = await response.json();
      setKycData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycStatus();
  }, []);

  // File upload handler
  const uploadFile = async (file: File, type: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Upload failed");
      }

      const result = await response.json();
      return result.url;
    } catch (err) {
      toast({
        title: "Upload Error",
        description: err instanceof Error ? err.message : "Failed to upload file",
        variant: "destructive",
      });
      return null;
    }
  };

  // Handle file selection
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: React.Dispatch<React.SetStateAction<UploadedFile | null>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File",
        description: "Please upload a JPEG, PNG, WebP, or PDF file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    // Create preview URL
    const preview = URL.createObjectURL(file);
    setFile({ file, preview });
  };

  // Clear file
  const clearFile = (
    setFile: React.Dispatch<React.SetStateAction<UploadedFile | null>>,
    currentFile: UploadedFile | null
  ) => {
    if (currentFile?.preview) {
      URL.revokeObjectURL(currentFile.preview);
    }
    setFile(null);
  };

  const handleSubmitStep = async (step: string, data: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, ...data }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to submit");
      }

      toast({
        title: "Success",
        description: step === "selfie"
          ? "Verification submitted. We will review your documents within 24-48 hours."
          : "Step completed. Please continue with the next step.",
      });

      setActiveStep(null);
      // Clear form data
      if (step === "identity") {
        setDocumentFront(null);
        setDocumentBack(null);
        setIdNumber("");
      } else if (step === "address") {
        setAddressProof(null);
        setAddressLine1("");
        setAddressCity("");
        setAddressState("");
        setAddressPostal("");
      } else if (step === "selfie") {
        setSelfieImage(null);
      }
      fetchKycStatus();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to submit",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleIdentitySubmit = async () => {
    if (!documentFront) {
      toast({
        title: "Missing Document",
        description: "Please upload the front of your ID document",
        variant: "destructive",
      });
      return;
    }

    if (!idNumber) {
      toast({
        title: "Missing Information",
        description: "Please enter your document number",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Upload document front
      const frontUrl = await uploadFile(documentFront.file, "kyc-document-front");
      if (!frontUrl) {
        setUploading(false);
        return;
      }

      // Upload document back if provided
      let backUrl: string | undefined;
      if (documentBack) {
        backUrl = await uploadFile(documentBack.file, "kyc-document-back") || undefined;
      }

      setUploading(false);
      handleSubmitStep("identity", {
        documentType: idType,
        documentNumber: idNumber,
        documentCountry: idCountry,
        documentFrontUrl: frontUrl,
        documentBackUrl: backUrl,
      });
    } catch {
      setUploading(false);
    }
  };

  const handleAddressSubmit = async () => {
    if (!addressProof) {
      toast({
        title: "Missing Document",
        description: "Please upload a proof of address document",
        variant: "destructive",
      });
      return;
    }

    if (!addressLine1 || !addressCity) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required address fields",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const proofUrl = await uploadFile(addressProof.file, "kyc-address-proof");
      if (!proofUrl) {
        setUploading(false);
        return;
      }

      setUploading(false);
      handleSubmitStep("address", {
        addressLine1,
        city: addressCity,
        state: addressState,
        postalCode: addressPostal,
        country: addressCountry,
        addressProofUrl: proofUrl,
      });
    } catch {
      setUploading(false);
    }
  };

  const handleSelfieSubmit = async () => {
    if (!selfieImage) {
      toast({
        title: "Missing Selfie",
        description: "Please upload or take a selfie",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const selfieUrl = await uploadFile(selfieImage.file, "kyc-selfie");
      if (!selfieUrl) {
        setUploading(false);
        return;
      }

      setUploading(false);
      handleSubmitStep("selfie", {
        selfieUrl,
      });
    } catch {
      setUploading(false);
    }
  };

  const isProcessing = submitting || uploading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completedSteps = kycData?.steps
    ? Object.values(kycData.steps).filter(s => s.completed).length
    : 0;
  const totalSteps = 3;
  const progress = (completedSteps / totalSteps) * 100;

  const overallStatus = kycData?.status || "NOT_STARTED";
  const config = statusConfig[overallStatus] || statusConfig.NOT_STARTED;
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Identity Verification</h1>
        <p className="text-muted-foreground">
          Complete verification to unlock all features
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <StatusIcon className={`h-8 w-8 ${config.color}`} />
              <div>
                <p className="font-semibold text-lg">{config.label}</p>
                <p className="text-sm text-muted-foreground">
                  {completedSteps} of {totalSteps} steps completed
                </p>
              </div>
            </div>
            <Badge variant={overallStatus === "APPROVED" ? "default" : "secondary"}>
              Level {kycData?.level || "0"}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Verification Steps */}
      <div className="space-y-4">
        {(["identity", "address", "selfie"] as const).map((step) => {
          const Icon = stepIcons[step];
          const stepData = kycData?.steps?.[step] || { completed: false, status: "NOT_STARTED" };
          const stepStatus = statusConfig[stepData.status] || statusConfig.NOT_STARTED;
          const StepStatusIcon = stepStatus.icon;

          return (
            <Card key={step} className={activeStep === step ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      stepData.completed ? "bg-green-100" : "bg-muted"
                    }`}>
                      <Icon className={`h-5 w-5 ${stepData.completed ? "text-green-600" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{stepLabels[step]}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <StepStatusIcon className={`h-3 w-3 ${stepStatus.color}`} />
                        {stepStatus.label}
                      </CardDescription>
                    </div>
                  </div>
                  {!stepData.completed && stepData.status !== "PENDING" && (
                    <Button
                      variant={activeStep === step ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setActiveStep(activeStep === step ? null : step)}
                    >
                      {activeStep === step ? "Cancel" : "Start"}
                    </Button>
                  )}
                </div>
              </CardHeader>

              {activeStep === step && (
                <CardContent className="space-y-4 border-t pt-4">
                  {step === "identity" && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Document Type</Label>
                          <Select value={idType} onValueChange={setIdType}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="passport">Passport</SelectItem>
                              <SelectItem value="drivers_license">Driver&apos;s License</SelectItem>
                              <SelectItem value="national_id">National ID</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Country of Issue</Label>
                          <Select value={idCountry} onValueChange={setIdCountry}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="US">United States</SelectItem>
                              <SelectItem value="GB">United Kingdom</SelectItem>
                              <SelectItem value="CA">Canada</SelectItem>
                              <SelectItem value="AU">Australia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Document Number</Label>
                        <Input
                          placeholder="Enter document number"
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Upload Document (Front) *</Label>
                        <input
                          type="file"
                          ref={documentFrontRef}
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, setDocumentFront)}
                        />
                        {documentFront ? (
                          <div className="relative border rounded-lg p-4">
                            <div className="flex items-center gap-3">
                              {documentFront.file.type.startsWith("image/") ? (
                                <img
                                  src={documentFront.preview}
                                  alt="Document front"
                                  className="h-16 w-16 object-cover rounded"
                                />
                              ) : (
                                <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-medium text-sm">{documentFront.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(documentFront.file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => clearFile(setDocumentFront, documentFront)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => documentFrontRef.current?.click()}
                          >
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Click to upload front of document
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              JPEG, PNG, WebP, or PDF (max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Upload Document (Back) - Optional</Label>
                        <input
                          type="file"
                          ref={documentBackRef}
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, setDocumentBack)}
                        />
                        {documentBack ? (
                          <div className="relative border rounded-lg p-4">
                            <div className="flex items-center gap-3">
                              {documentBack.file.type.startsWith("image/") ? (
                                <img
                                  src={documentBack.preview}
                                  alt="Document back"
                                  className="h-16 w-16 object-cover rounded"
                                />
                              ) : (
                                <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-medium text-sm">{documentBack.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(documentBack.file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => clearFile(setDocumentBack, documentBack)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => documentBackRef.current?.click()}
                          >
                            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Click to upload back of document (if applicable)
                            </p>
                          </div>
                        )}
                      </div>
                      <Button onClick={handleIdentitySubmit} disabled={isProcessing || !idNumber || !documentFront}>
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {uploading ? "Uploading..." : "Submitting..."}
                          </>
                        ) : (
                          "Submit Identity Document"
                        )}
                      </Button>
                    </>
                  )}

                  {step === "address" && (
                    <>
                      <div className="space-y-2">
                        <Label>Street Address *</Label>
                        <Input
                          placeholder="123 Main Street"
                          value={addressLine1}
                          onChange={(e) => setAddressLine1(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>City *</Label>
                          <Input
                            placeholder="City"
                            value={addressCity}
                            onChange={(e) => setAddressCity(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>State/Province</Label>
                          <Input
                            placeholder="State"
                            value={addressState}
                            onChange={(e) => setAddressState(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Postal Code</Label>
                          <Input
                            placeholder="12345"
                            value={addressPostal}
                            onChange={(e) => setAddressPostal(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Country *</Label>
                          <Select value={addressCountry} onValueChange={setAddressCountry}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="US">United States</SelectItem>
                              <SelectItem value="GB">United Kingdom</SelectItem>
                              <SelectItem value="CA">Canada</SelectItem>
                              <SelectItem value="AU">Australia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Proof of Address (Utility bill, bank statement) *</Label>
                        <input
                          type="file"
                          ref={addressProofRef}
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, setAddressProof)}
                        />
                        {addressProof ? (
                          <div className="relative border rounded-lg p-4">
                            <div className="flex items-center gap-3">
                              {addressProof.file.type.startsWith("image/") ? (
                                <img
                                  src={addressProof.preview}
                                  alt="Address proof"
                                  className="h-16 w-16 object-cover rounded"
                                />
                              ) : (
                                <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-medium text-sm">{addressProof.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(addressProof.file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => clearFile(setAddressProof, addressProof)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => addressProofRef.current?.click()}
                          >
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Click to upload proof of address
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              JPEG, PNG, WebP, or PDF (max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                      <Button onClick={handleAddressSubmit} disabled={isProcessing || !addressLine1 || !addressCity || !addressProof}>
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {uploading ? "Uploading..." : "Submitting..."}
                          </>
                        ) : (
                          "Submit Address Verification"
                        )}
                      </Button>
                    </>
                  )}

                  {step === "selfie" && (
                    <>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Take a clear selfie to verify your identity. Make sure your face is clearly visible and well-lit.
                        </p>
                        <input
                          type="file"
                          ref={selfieRef}
                          accept="image/jpeg,image/png,image/webp"
                          capture="user"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, setSelfieImage)}
                        />
                        {selfieImage ? (
                          <div className="relative border rounded-lg p-4">
                            <div className="flex flex-col items-center gap-4">
                              <img
                                src={selfieImage.preview}
                                alt="Selfie preview"
                                className="h-48 w-48 object-cover rounded-full"
                              />
                              <div className="text-center">
                                <p className="font-medium text-sm">{selfieImage.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(selfieImage.file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => clearFile(setSelfieImage, selfieImage)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Remove & Try Again
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => selfieRef.current?.click()}
                          >
                            <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                            <p className="font-medium">Take a Selfie</p>
                            <p className="text-sm text-muted-foreground">
                              Click to open camera or upload a photo
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              JPEG, PNG, or WebP (max 10MB)
                            </p>
                          </div>
                        )}
                      </div>
                      <Button onClick={handleSelfieSubmit} disabled={isProcessing || !selfieImage}>
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {uploading ? "Uploading..." : "Submitting..."}
                          </>
                        ) : (
                          "Submit Selfie"
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Verification Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Increased transaction limits
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Access to all payment features
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Priority customer support
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Enhanced account protection
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
