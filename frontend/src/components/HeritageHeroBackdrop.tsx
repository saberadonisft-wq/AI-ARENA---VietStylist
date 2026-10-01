export function HeritageHeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden bg-heritage-parchment">
      <div className="absolute inset-0 lg:left-1/2 lg:right-auto lg:w-full lg:min-w-[1600px] lg:-translate-x-1/2">
        {/* Native picture selects one composition before downloading the hero. */}
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/heritage/vietnam-landscape-hero-mobile.webp" />
          <img
            src="/images/heritage/vietnam-landscape-hero.webp"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center md:object-left lg:object-center"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-heritage-parchment/80 via-heritage-parchment/80 via-55% to-transparent md:from-heritage-parchment/95 md:via-heritage-parchment/75 md:via-45% lg:hidden" />
      </div>
      <div className="absolute inset-y-0 left-1/2 hidden w-full max-w-6xl -translate-x-1/2 bg-gradient-to-r from-transparent via-heritage-parchment/80 to-transparent lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-heritage-parchment to-transparent sm:h-24 lg:h-56 lg:from-5% lg:via-heritage-parchment/80 lg:via-30%" />
    </div>
  );
}
