export default function LoadingSpinner({ size = "md" }) {
  const dims = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" }[size];
  return (
    <div className="flex items-center justify-center">
      <div
        className={`${dims} border-2 border-gray-700 border-t-cyan-400 rounded-full animate-spin`}
      />
    </div>
  );
}
