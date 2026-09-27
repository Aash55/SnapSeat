export const EventCardSkeleton = () => {
  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-5 w-full">
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-gray-800 rounded-lg animate-pulse"></div>
          <div className="flex flex-col gap-1.5">
            <div className="w-10 h-3 bg-gray-800 rounded animate-pulse"></div>
            <div className="w-8 h-3 bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex flex-col gap-2">
        <div className="w-3/4 h-5 bg-gray-800 rounded animate-pulse"></div>
        <div className="w-1/2 h-5 bg-gray-800 rounded animate-pulse"></div>
      </div>
      
      <div className="mt-5 w-2/3 h-4 bg-gray-800 rounded animate-pulse"></div>
      <div className="mt-2 w-1/2 h-4 bg-gray-800 rounded animate-pulse"></div>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-dashed border-dark-border">
        <div className="w-20 h-4 bg-gray-800 rounded animate-pulse"></div>
        <div className="w-24 h-9 bg-gray-800 rounded-lg animate-pulse"></div>
      </div>
    </div>
  );
};
