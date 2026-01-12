import ProfileHeader from "@/components/ProfileHeader";
import ProfileCard from "@/components/ProfileCard";
import ContentTabs from "@/components/ContentTabs";
import LockedPost from "@/components/LockedPost";

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-8">
      <ProfileHeader />
      
      <main className="space-y-4 mt-2">
        <ProfileCard />
        <ContentTabs />
        <LockedPost />
      </main>
    </div>
  );
};

export default Index;
