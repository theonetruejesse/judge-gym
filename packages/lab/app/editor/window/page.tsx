import { WindowForm } from "./_components/window-form";
import {
  getWindowFormDefaultsFromSearchParams,
  type WindowFormSearchParams,
} from "./_utils/window-form-schema";

interface WindowFormPageProps {
  searchParams?: Promise<WindowFormSearchParams>;
}

export default async function WindowFormPage({
  searchParams,
}: WindowFormPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const defaultValues = getWindowFormDefaultsFromSearchParams(
    resolvedSearchParams,
  );
  return (
    <div className="mx-auto max-w-2xl py-10 px-4">
      <WindowForm defaultValues={defaultValues} />
    </div>
  );
}
