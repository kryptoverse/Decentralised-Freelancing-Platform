"use client";

export function ProfileLoader() {
  return (
    <div className="p-8 flex flex-col items-center justify-center space-y-3">
      <div className="animate-spin border-4 border-primary border-t-transparent rounded-full w-10 h-10" />
      <p className="text-muted-foreground">Loading your profile...</p>
    </div>
  );
}
