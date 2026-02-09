export async function generateMetadata({ params }: { params: { id?: string } }) {
  const id = params?.id;
  return {
    title: id ? `Deal #${id}` : "Deal",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
