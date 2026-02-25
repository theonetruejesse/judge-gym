import { ExperimentEditor } from "./_components/experiment-editor";
import {
  getExperimentFormDefaultsFromSearchParams,
  type ExperimentFormSearchParams,
} from "./_utils/experiment-form-schema";

interface ExperimentEditorPageProps {
  searchParams: ExperimentFormSearchParams;
}

export default function ExperimentEditorPage({
  searchParams,
}: ExperimentEditorPageProps) {
  const defaultValues = getExperimentFormDefaultsFromSearchParams(searchParams);

  return <ExperimentEditor defaultValues={defaultValues} />;
}
