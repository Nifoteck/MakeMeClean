interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<string, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-4",
};

export default function Spinner({ size = "lg" }: SpinnerProps) {
  return (
    <div
      className={`${SIZE[size]} border-green-600 border-t-transparent rounded-full animate-spin`}
    />
  );
}
