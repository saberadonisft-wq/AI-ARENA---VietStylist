export function HeritageGarmentBackdrop({
  src,
  mobileSrc,
  isEven,
}: {
  src: string;
  mobileSrc: string;
  isEven: boolean;
}) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden bg-heritage-parchment">
      <div className="absolute inset-x-0 top-0 h-[520px] sm:h-[720px] lg:bottom-0 lg:left-1/2 lg:right-auto lg:h-full lg:w-full lg:min-w-[1600px] lg:-translate-x-1/2">
        <picture>
          <source media="(max-width: 767px)" srcSet={mobileSrc} />
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover object-center lg:opacity-80 lg:object-center ${isEven ? "md:object-left" : "md:object-right"}`}
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-65% to-heritage-parchment lg:hidden" />
      </div>
      <div className="absolute inset-0 hidden bg-gradient-to-r from-transparent via-heritage-parchment/80 to-transparent lg:block" />
      <div className="absolute inset-y-0 left-1/2 hidden w-full max-w-7xl -translate-x-1/2 lg:block">
        <div className={`absolute inset-y-8 w-2/3 bg-heritage-parchment/90 blur-2xl ${isEven ? "right-0" : "left-0"}`} />
      </div>
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-heritage-parchment to-transparent sm:h-20 lg:h-48 lg:from-5% lg:via-heritage-parchment/80 lg:via-30%" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-heritage-parchment from-5% via-heritage-parchment/80 via-30% to-transparent sm:h-48" />
    </div>
  );
}
