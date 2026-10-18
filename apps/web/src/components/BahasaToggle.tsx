import { useBahasaStore, useT } from "../store/bahasa";

export default function BahasaToggle(): JSX.Element {
  const bahasa = useBahasaStore((s) => s.bahasa);
  const setBahasa = useBahasaStore((s) => s.setBahasa);
  const t = useT();

  const aktif =
    "rounded px-2 py-1 font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900";
  const pasif = "rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800";

  return (
    <div
      role="group"
      aria-label={t("bahasaGanti")}
      title={t("bahasaGanti")}
      className="flex items-center gap-1 rounded border px-1 py-0.5 dark:border-slate-600"
    >
      <button
        type="button"
        onClick={() => setBahasa("id")}
        aria-pressed={bahasa === "id"}
        className={bahasa === "id" ? aktif : pasif}
      >
        ID
      </button>
      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
        |
      </span>
      <button
        type="button"
        onClick={() => setBahasa("en")}
        aria-pressed={bahasa === "en"}
        className={bahasa === "en" ? aktif : pasif}
      >
        EN
      </button>
    </div>
  );
}
