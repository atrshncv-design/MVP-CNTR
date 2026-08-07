import { auth } from "@/auth.config";
import { redirect } from "next/navigation";
import JoinTokenClient from "./join-token-client";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinTokenPage({ params }: Props) {
  const session = await auth();
  const { token } = await params;

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/join/${token}`)}`);
  }

  return <JoinTokenClient token={token} accessToken={session.user.accessToken} />;
}
