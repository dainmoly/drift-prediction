import Footer from "./Footer";
import Header from "./Header";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="xl:container w-full flex flex-col gap-4 mx-auto p-4 min-h-screen">

      <Header />

      <div className="flex-1">
        {children}
      </div>

      <Footer />

    </div>
  )
}