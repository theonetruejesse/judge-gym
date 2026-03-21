import { ExperimentEditor } from "./_components/experiment-editor";
import {
  getExperimentFormDefaultsFromSearchParams,
  type ExperimentFormSearchParams,
} from "./_utils/experiment-form-schema";

interface ExperimentEditorPageProps {
  searchParams?: Promise<ExperimentFormSearchParams>;
}

export default async function ExperimentEditorPage({
  searchParams,
}: ExperimentEditorPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const defaultValues = getExperimentFormDefaultsFromSearchParams(
    resolvedSearchParams,
  );

  return <ExperimentEditor defaultValues={defaultValues} />;
}
