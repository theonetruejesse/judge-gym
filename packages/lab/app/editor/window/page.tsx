import { WindowForm } from "./_components/window-form";
import {
  getWindowFormDefaultsFromSearchParams,
  type WindowFormSearchParams,
} from "./_utils/window-form-schema";

interface WindowFormPageProps {
  searchParams: WindowFormSearchParams;
}

export default function WindowFormPage({ searchParams }: WindowFormPageProps) {
  const defaultValues = getWindowFormDefaultsFromSearchParams(searchParams);
  return (
    <div className="mx-auto max-w-2xl py-10 px-4">
      <WindowForm defaultValues={defaultValues} />
    </div>
  );
}
