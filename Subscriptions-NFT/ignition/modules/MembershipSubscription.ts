import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MembershipSubscriptionModule", (m) => {
  // Initial subscription price (0.01 ETH in wei)
  const initialPrice = "10000000000000000";
  
  // Deploy the MembershipSubscription contract
  const membershipSubscription = m.contract("MembershipSubscription", [initialPrice]);
  
  return { membershipSubscription };
});