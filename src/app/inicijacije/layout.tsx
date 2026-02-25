export async function generateMetadata({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const { id } = await params;
  return {
    title: id ? `Deal #${id}` : "Deal",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
