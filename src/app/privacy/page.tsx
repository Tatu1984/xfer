import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: January 15, 2024</p>
          </CardHeader>
          <CardContent className="prose prose-gray dark:prose-invert max-w-none">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">1. Information We Collect</h2>
              <p className="text-muted-foreground">
                We collect information you provide directly to us, such as when you create an
                account, make a transaction, or contact us for support.
              </p>
              <h3 className="text-lg font-medium">Personal Information</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Name, email address, and phone number</li>
                <li>Date of birth and government ID for verification</li>
                <li>Financial information (bank accounts, payment cards)</li>
                <li>Transaction history and account activity</li>
                <li>Device information and IP addresses</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">2. How We Use Your Information</h2>
              <p className="text-muted-foreground">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Verify your identity and prevent fraud</li>
                <li>Comply with legal obligations</li>
                <li>Communicate with you about products, services, and updates</li>
                <li>Monitor and analyze trends, usage, and activities</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">3. Information Sharing</h2>
              <p className="text-muted-foreground">
                We do not sell your personal information. We may share your information in the
                following circumstances:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>With your consent or at your direction</li>
                <li>With service providers who assist in our operations</li>
                <li>To comply with legal obligations or protect our rights</li>
                <li>In connection with a merger, acquisition, or sale of assets</li>
                <li>With financial institutions to process transactions</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">4. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate technical and organizational measures to protect your
                personal information, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>256-bit SSL encryption for data transmission</li>
                <li>Secure data centers with 24/7 monitoring</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and employee training</li>
                <li>PCI-DSS compliance for payment processing</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">5. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information for as long as necessary to provide our
                services and fulfill the purposes described in this policy. We may also retain
                information to comply with legal obligations, resolve disputes, and enforce our
                agreements.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">6. Your Rights</h2>
              <p className="text-muted-foreground">
                Depending on your location, you may have certain rights regarding your personal
                information:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Access and portability of your data</li>
                <li>Correction of inaccurate information</li>
                <li>Deletion of your personal information</li>
                <li>Restriction or objection to processing</li>
                <li>Withdrawal of consent</li>
              </ul>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">7. Cookies and Tracking</h2>
              <p className="text-muted-foreground">
                We use cookies and similar technologies to collect information about your
                browsing activities. You can manage your cookie preferences through your browser
                settings.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">8. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our services are not intended for children under 18 years of age. We do not
                knowingly collect personal information from children.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">9. International Transfers</h2>
              <p className="text-muted-foreground">
                Your information may be transferred to and processed in countries other than
                your country of residence. We ensure appropriate safeguards are in place for
                such transfers.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">10. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy or our data practices, please
                contact us:
              </p>
              <p className="text-muted-foreground">
                Email: privacy@xfer.app<br />
                Address: 123 Financial Street, San Francisco, CA 94102
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
