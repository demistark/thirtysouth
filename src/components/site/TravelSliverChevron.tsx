export function TravelSliverChevron({ active, open }: { active: boolean; open: boolean }) {
  return (
    <svg
      className="travel-sliver-chevron"
      data-active={active}
      data-open={open}
      width="9"
      height="4.5"
      viewBox="0 0 9 4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 .9 4.5 3.6 8 .9" />
    </svg>
  );
}