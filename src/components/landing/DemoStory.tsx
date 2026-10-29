import { EarlyAccess } from "./LeadForm";
import { BrandHeart } from "./StoryArt";

export default function DemoStory({ onPrivacy, selectedPlan }: {
  onPrivacy: () => void; selectedPlan: string;
}) {
  return <div id="demo" className="m-access-composition">
    <BrandHeart className="m-access-art" />
    <EarlyAccess onPrivacy={onPrivacy} selectedPlan={selectedPlan} />
  </div>;
}
