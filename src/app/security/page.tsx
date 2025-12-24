import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, Server, CheckCircle, AlertTriangle } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        <div className="text-center mb-12">
          <Shield className="h-16 w-16 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold mb-4">Security at Xfer</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your security is our top priority. Learn about the measures we take to
            protect your account and financial information.
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Lock className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Encryption</CardTitle>
                  <CardDescription>Industry-leading data protection</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">256-bit SSL/TLS Encryption</h4>
                  <p className="text-muted-foreground">
                    All data transmitted between your device and our servers is encrypted
                    using bank-grade SSL encryption.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">End-to-End Encryption</h4>
                  <p className="text-muted-foreground">
                    Sensitive data is encrypted at rest and in transit, ensuring only
                    authorized parties can access it.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Tokenization</h4>
                  <p className="text-muted-foreground">
                    Payment card numbers are tokenized, so your actual card details are
                    never stored on our servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Eye className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Fraud Prevention</CardTitle>
                  <CardDescription>Advanced monitoring and detection</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">24/7 Transaction Monitoring</h4>
                  <p className="text-muted-foreground">
                    Our systems continuously monitor all transactions for suspicious
                    activity using machine learning algorithms.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Risk-Based Authentication</h4>
                  <p className="text-muted-foreground">
                    Additional verification steps are triggered for unusual or high-risk
                    transactions to protect your account.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Device Fingerprinting</h4>
                  <p className="text-muted-foreground">
                    We recognize your trusted devices and alert you when your account is
                    accessed from a new device.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Account Protection</CardTitle>
                  <CardDescription>Multiple layers of security</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Two-Factor Authentication (2FA)</h4>
                  <p className="text-muted-foreground">
                    Add an extra layer of security with SMS codes or authenticator apps
                    to prevent unauthorized access.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Biometric Login</h4>
                  <p className="text-muted-foreground">
                    Use fingerprint or face recognition on supported devices for quick
                    and secure access.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Login Notifications</h4>
                  <p className="text-muted-foreground">
                    Receive instant alerts when your account is accessed from a new
                    location or device.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Server className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Infrastructure Security</CardTitle>
                  <CardDescription>Enterprise-grade protection</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">SOC 2 Type II Certified</h4>
                  <p className="text-muted-foreground">
                    Our systems and processes have been independently audited and
                    certified for security and availability.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">PCI-DSS Level 1 Compliant</h4>
                  <p className="text-muted-foreground">
                    We meet the highest level of Payment Card Industry Data Security
                    Standards.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Regular Security Audits</h4>
                  <p className="text-muted-foreground">
                    Third-party security firms conduct regular penetration testing and
                    vulnerability assessments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
                <div>
                  <CardTitle>Security Tips</CardTitle>
                  <CardDescription>Protect yourself from threats</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-muted-foreground">
                <li>Never share your password or verification codes with anyone</li>
                <li>Enable two-factor authentication for maximum security</li>
                <li>Use a strong, unique password for your Xfer account</li>
                <li>Be cautious of phishing emails or suspicious links</li>
                <li>Always log out when using shared or public computers</li>
                <li>Keep your contact information up to date for security alerts</li>
                <li>Report any suspicious activity immediately</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance & Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="py-2 px-4">PCI-DSS Level 1</Badge>
                <Badge variant="outline" className="py-2 px-4">SOC 2 Type II</Badge>
                <Badge variant="outline" className="py-2 px-4">GDPR Compliant</Badge>
                <Badge variant="outline" className="py-2 px-4">ISO 27001</Badge>
                <Badge variant="outline" className="py-2 px-4">CCPA Compliant</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
