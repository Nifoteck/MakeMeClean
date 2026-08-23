import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Trophy, Star, Gift, Clock, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/apiClient";

interface LoyaltyPoint {
  id: string;
  points: number;
  reason: string;
  created_at: string;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  points_required: number;
  active: boolean;
}

const TIERS = [
  {
    name: "Bronze",
    min: 0,
    max: 499,
    color: "bg-amber-700",
    textColor: "text-amber-700",
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    emoji: "🥉",
  },
  {
    name: "Silver",
    min: 500,
    max: 999,
    color: "bg-gray-400",
    textColor: "text-gray-500",
    bgLight: "bg-gray-50",
    border: "border-gray-200",
    emoji: "🥈",
  },
  {
    name: "Gold",
    min: 1000,
    max: 2499,
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    bgLight: "bg-yellow-50",
    border: "border-yellow-200",
    emoji: "🥇",
  },
  {
    name: "Platinum",
    min: 2500,
    max: Infinity,
    color: "bg-purple-600",
    textColor: "text-purple-700",
    bgLight: "bg-purple-50",
    border: "border-purple-200",
    emoji: "💎",
  },
];

function getTier(points: number) {
  return TIERS.find((t) => points >= t.min && points <= t.max) ?? TIERS[0];
}

function ProgressBar({ points }: { points: number }) {
  const tier = getTier(points);
  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  if (!nextTier)
    return (
      <div className="mt-4">
        <p className="text-xs font-semibold text-purple-600">
          You've reached the highest tier! 🎉
        </p>
      </div>
    );
  const progress = Math.min(
    ((points - tier.min) / (nextTier.min - tier.min)) * 100,
    100
  );
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
        <span>{tier.name}</span>
        <span>
          {points} / {nextTier.min} pts to {nextTier.name}
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function Loyalty() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [totalPoints, setTotalPoints] = useState(0);
  const [history, setHistory] = useState<LoyaltyPoint[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("loyalty_points")
        .select("id, points, reason, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("active", true)
        .order("points_required"),
    ]).then(([{ data: pts }, { data: rws }]) => {
      const hist = (pts ?? []) as LoyaltyPoint[];
      setHistory(hist);
      setTotalPoints(hist.reduce((sum, p) => sum + p.points, 0));
      setRewards((rws ?? []) as Reward[]);
      setFetching(false);
    });
  }, [user]);

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tier = getTier(totalPoints);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            Loyalty Rewards
          </h1>
          <p className="text-gray-500">
            Earn points with every booking and unlock exclusive rewards.
          </p>
        </div>

        {/* Tier card */}
        <div
          className={cn("rounded-2xl border p-6", tier.bgLight, tier.border)}
        >
          <div className="flex items-center gap-4">
            <div className="text-5xl">{tier.emoji}</div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-0.5">
                Current tier
              </p>
              <p className={cn("text-2xl font-black", tier.textColor)}>
                {tier.name}
              </p>
              <p className="text-3xl font-black text-gray-900 mt-1">
                {totalPoints.toLocaleString()} pts
              </p>
            </div>
          </div>
          <ProgressBar points={totalPoints} />
        </div>

        {/* How it works */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-black text-gray-900 mb-4">
            How it works
          </h2>
          <div className="space-y-3">
            {[
              {
                icon: Star,
                text: "Earn 10 points for every £1 spent on bookings",
              },
              {
                icon: Trophy,
                text: "Reach Silver (500), Gold (1,000) or Platinum (2,500) for better perks",
              },
              {
                icon: Gift,
                text: "Redeem points for discounts and free cleans",
              },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-sm text-gray-600 mt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Available rewards */}
        {rewards.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">
                Available Rewards
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {rewards.map((r) => {
                const canRedeem = totalPoints >= r.points_required;
                return (
                  <div key={r.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">
                        {r.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-sm font-bold",
                          canRedeem ? "text-green-600" : "text-gray-400"
                        )}
                      >
                        {r.points_required.toLocaleString()} pts
                      </p>
                      {canRedeem && (
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          Available!
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Points history */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-sm font-black text-gray-900">Points History</h2>
          </div>
          {history.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-medium text-sm">
                No points yet. Complete a booking to start earning!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="px-6 py-4 flex items-center gap-3"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black",
                      item.points > 0
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-500"
                    )}
                  >
                    {item.points > 0 ? "+" : ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">
                      {item.reason}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-black shrink-0",
                      item.points > 0 ? "text-green-600" : "text-red-500"
                    )}
                  >
                    {item.points > 0 ? "+" : ""}
                    {item.points.toLocaleString()} pts
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
