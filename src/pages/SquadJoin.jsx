import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function SquadJoin() {
  const { inviteCode } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [squad, setSquad] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    base44.entities.Squad.filter({ invite_code: inviteCode }).then((res) => {
      setSquad(res[0] || null);
      setLoading(false);
    });
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!squad || !user) return;
    setJoining(true);
    try {
      await base44.entities.Squad.update(squad.id, {
        member_b_id: user.id,
        member_b_name: user.full_name || user.email,
        status: "active",
      });
      toast.success("You're linked up! Bonus tracking starts now.");
      navigate("/squad");
    } catch (err) {
      toast.error("Couldn't join this squad.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!squad || squad.status === "ended") {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-3">
        <h1 className="font-heading text-xl font-bold">Invalid invite</h1>
        <p className="text-sm text-muted-foreground">This squad invite doesn't exist or has ended.</p>
        <Link to="/squad"><Button variant="outline" className="rounded-full">Go to Squad & Scale</Button></Link>
      </div>
    );
  }

  if (user && squad.member_a_id === user.id) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-3">
        <h1 className="font-heading text-xl font-bold">This is your own invite</h1>
        <p className="text-sm text-muted-foreground">Share this link with a friend so they can join your squad.</p>
        <Link to="/squad"><Button variant="outline" className="rounded-full">Go to Squad & Scale</Button></Link>
      </div>
    );
  }

  if (squad.status === "active" || squad.member_b_id) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-3">
        <h1 className="font-heading text-xl font-bold">Invite already used</h1>
        <p className="text-sm text-muted-foreground">This squad is already full.</p>
        <Link to="/squad"><Button variant="outline" className="rounded-full">Go to Squad & Scale</Button></Link>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-3">
        <Users className="w-10 h-10 mx-auto text-primary/60" />
        <h1 className="font-heading text-xl font-bold">{squad.member_a_name} invited you to squad up</h1>
        <p className="text-sm text-muted-foreground">Log in to accept and start tracking your weekend bonus together.</p>
        <Link to={`/login?returnTo=${encodeURIComponent(`/squad/join/${inviteCode}`)}`}>
          <Button className="rounded-full bg-gradient-to-r from-primary to-accent text-white">Log In to Join</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 text-center space-y-4">
      <Users className="w-10 h-10 mx-auto text-primary/60" />
      <h1 className="font-heading text-xl font-bold">{squad.member_a_name} invited you to squad up</h1>
      <p className="text-sm text-muted-foreground">Hit your weekly chat or task goals together and you'll both unlock a 1.5x weekend bonus.</p>
      <Button onClick={handleJoin} disabled={joining} className="rounded-full bg-gradient-to-r from-primary to-accent text-white">
        {joining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
        Join Squad
      </Button>
    </div>
  );
}