export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_NAME: process.env.DB_NAME,
    DB_SSL: process.env.DB_SSL,
  });
}
