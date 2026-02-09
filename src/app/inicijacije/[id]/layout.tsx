export async function generateMetadata({ params }: { params: { id?: string } }) {
  const id = params?.id;
  return {
//    title: id ? `Fluxa – Deal #${id}` : "Fluxa – Deal",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
