class LoyaltyReward {
  final String id;
  final String title;
  final String description;
  final int pointsCost;
  final String discountType; // percentage or fixed
  final double discountValue;

  LoyaltyReward({
    required this.id,
    required this.title,
    required this.description,
    required this.pointsCost,
    required this.discountType,
    required this.discountValue,
  });
}

class UserLoyaltyInfo {
  final int totalPoints;
  final String tier; // Bronze, Silver, Gold, Platinum
  final int pointsToNextTier;
  final double nextTierProgress;

  UserLoyaltyInfo({
    required this.totalPoints,
    required this.tier,
    required this.pointsToNextTier,
    required this.nextTierProgress,
  });

  factory UserLoyaltyInfo.fromPoints(int points) {
    String tier = 'Bronze';
    int nextTarget = 500;
    int prevTarget = 0;

    if (points >= 2000) {
      tier = 'Platinum';
      nextTarget = 2000;
      prevTarget = 2000;
    } else if (points >= 1000) {
      tier = 'Gold';
      nextTarget = 2000;
      prevTarget = 1000;
    } else if (points >= 500) {
      tier = 'Silver';
      nextTarget = 1000;
      prevTarget = 500;
    } else {
      tier = 'Bronze';
      nextTarget = 500;
      prevTarget = 0;
    }

    final diff = nextTarget - prevTarget;
    final earnedInTier = points - prevTarget;
    final progress = diff > 0 ? (earnedInTier / diff).clamp(0.0, 1.0) : 1.0;
    final needed = (nextTarget - points).clamp(0, nextTarget);

    return UserLoyaltyInfo(
      totalPoints: points,
      tier: tier,
      pointsToNextTier: needed,
      nextTierProgress: progress,
    );
  }
}

