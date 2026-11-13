import { connection } from "next/server";
import { StoreFooter } from "@/components/store/footer";
import { StoreHeader } from "@/components/store/header";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <>
      <StoreHeader />
      <main className="flex-1">{children}</main>
      <StoreFooter />
    </>
  );
}
