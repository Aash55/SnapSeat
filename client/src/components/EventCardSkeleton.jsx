export const EventCardSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-4 p-6 rounded-2xl bg-[#141219] border border-[#221F2A] overflow-hidden">
    <div className="flex items-center gap-3">
      <div className="sk w-[52px] h-11" />
      <div className="flex flex-col gap-1.5"><div className="sk w-9 h-3" /><div className="sk w-7 h-3" /></div>
    </div>
    <div className="flex flex-col gap-2.5 min-h-[58px]"><div className="sk w-[88%] h-[22px]" /><div className="sk w-[56%] h-[22px]" /></div>
    <div className="sk w-[70%] h-3.5" />
    <div className="perf -mx-6" />
    <div className="flex items-center justify-between"><div className="sk w-[84px] h-3.5" /><div className="sk w-[132px] h-11 rounded-[10px]" /></div>
  </div>
);
