import Image from "next/image";

export function LogoHeader() {
  return (
    <header>
      <div aria-hidden className="h-[2px] w-full bg-[var(--magenta)]" />
      <div className="mx-auto flex max-w-[1440px] items-center px-8 py-3">
        <Image
          src="/pharma-rx-logo.png"
          alt="PharmaRX — (pharmagenic) capsules"
          width={605}
          height={115}
          priority
          className="h-9 w-auto"
        />
      </div>
    </header>
  );
}
