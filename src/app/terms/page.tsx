import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: January 15, 2024</p>
          </CardHeader>
          <CardContent className="prose prose-gray dark:prose-invert max-w-none">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using the Xfer payment platform ("Service"), you agree to be bound
                by these Terms of Service ("Terms"). If you do not agree to all the terms and
                conditions, you may not access or use our Service.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">2. Description of Service</h2>
              <p className="text-muted-foreground">
                Xfer provides an online payment platform that enables users to send and receive
                money, manage transactions, and access various financial services. Our services
                include but are not limited to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Person-to-person money transfers</li>
                <li>Online payment processing for merchants</li>
                <li>Wallet balance management</li>
                <li>Transaction history and reporting</li>
                <li>Subscription and recurring payment management</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">3. Account Registration</h2>
              <p className="text-muted-foreground">
                To use our Service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Keep your password secure and confidential</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">4. User Conduct</h2>
              <p className="text-muted-foreground">
                You agree not to use the Service for any illegal or unauthorized purpose.
                Prohibited activities include:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Money laundering or terrorist financing</li>
                <li>Fraud or misrepresentation</li>
                <li>Violating any applicable laws or regulations</li>
                <li>Interfering with or disrupting the Service</li>
                <li>Attempting to gain unauthorized access to systems</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">5. Fees and Payments</h2>
              <p className="text-muted-foreground">
                Xfer may charge fees for certain services. All applicable fees will be disclosed
                before you complete a transaction. By using fee-based services, you agree to pay
                all fees and charges associated with your account.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">6. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, Xfer shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages, or any loss of profits or
                revenues, whether incurred directly or indirectly.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">7. Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate your account at any time for any
                reason, including violation of these Terms. Upon termination, your right to use
                the Service will immediately cease.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">8. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may modify these Terms at any time. We will notify you of any changes by
                posting the new Terms on this page. Your continued use of the Service after
                changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">9. Contact Information</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="text-muted-foreground">
                Email: legal@xfer.app<br />
                Address: 123 Financial Street, San Francisco, CA 94102
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
