"use client";

export function MenuBackdrop() {
  return <button type="button" aria-label="إغلاق القائمة" onClick={event => {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }} className="fixed inset-0 z-0 hidden cursor-default bg-[#0d0b1b]/55 group-open:block" />;
}
