import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from 'react-email';

export interface WelcomeEmailProps {
  firstName: string;
  verificationUrl: string;
}

export function WelcomeEmail({ firstName, verificationUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />

      <Preview>Welcome to InvenTree! Verify your email to activate your account.</Preview>

      <Tailwind>
        <Body className="bg-slate-100 py-10 font-sans">
          <Container className="mx-auto max-w-xl rounded-xl bg-white p-10 shadow-sm">
            <Heading className="m-0 text-3xl font-bold text-slate-900">
              Welcome to InvenTree 👋
            </Heading>

            <Text className="mt-6 text-base leading-7 text-slate-700">
              Hi <strong>{firstName}</strong>,
            </Text>

            <Text className="text-base leading-7 text-slate-700">
              Welcome to InvenTree. Your account has been created successfully.
            </Text>

            <Text className="text-base leading-7 text-slate-700">
              To complete your registration and begin managing inventory, verify your email address
              by clicking the button below.
            </Text>

            <Section className="my-8 text-center">
              <Button
                href={verificationUrl}
                className="rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white"
              >
                Verify Email Address
              </Button>
            </Section>

            <Text className="text-sm text-slate-600">
              This verification link will expire in <strong>30 minutes</strong>.
            </Text>

            <Text className="text-sm text-slate-600">
              If the button above doesn't work, copy and paste this URL into your browser:
            </Text>

            <Link href={verificationUrl} className="break-all text-sm text-blue-600">
              {verificationUrl}
            </Link>

            <Hr className="my-8 border-slate-200" />

            <Heading as="h2" className="mb-3 text-xl font-semibold text-slate-900">
              What you can do next
            </Heading>

            <Text className="text-base text-slate-700">• Create organizations and workspaces</Text>

            <Text className="text-base text-slate-700">
              • Manage inventory, stock movements, and parts
            </Text>

            <Text className="text-base text-slate-700">
              • Invite teammates with role-based permissions
            </Text>

            <Text className="text-base text-slate-700">
              • Track purchasing and inventory activity
            </Text>

            <Hr className="my-8 border-slate-200" />

            <Text className="text-sm text-slate-500">
              If you didn't create this account, you can safely ignore this email.
            </Text>

            <Text className="mt-6 text-sm text-slate-500">
              © {new Date().getFullYear()} InvenTree. All rights reserved.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default WelcomeEmail;
