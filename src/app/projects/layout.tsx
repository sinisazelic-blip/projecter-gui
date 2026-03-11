export async function generateMetadata({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const { id } = await params;
  return {
    title: id ? `Projekat #${id}` : "Projekat",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
