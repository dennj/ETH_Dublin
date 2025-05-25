import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("MembershipSubscription", function () {
  // Initial subscription price (0.01 ETH)
  const initialPrice = ethers.parseEther("0.01");
  const oneMonth = 30 * 24 * 60 * 60; // 30 days in seconds
  
  async function deployContract() {
    // Get signers
    const [owner, subscriber1, subscriber2] = await ethers.getSigners();
    
    // Deploy the contract
    const MembershipSubscription = await ethers.getContractFactory("MembershipSubscription");
    const membershipSubscription = await MembershipSubscription.deploy(initialPrice);
    
    return { membershipSubscription, owner, subscriber1, subscriber2 };
  }
  
  describe("Deployment", function () {
    it("Should set the correct initial price", async function () {
      const { membershipSubscription } = await deployContract();
      expect(await membershipSubscription.subscriptionPrice()).to.equal(initialPrice);
    });
    
    it("Should set the correct owner", async function () {
      const { membershipSubscription, owner } = await deployContract();
      expect(await membershipSubscription.owner()).to.equal(owner.address);
    });
  });
  
  describe("Subscription Purchase", function () {
    it("Should allow purchasing a subscription", async function () {
      const { membershipSubscription, subscriber1 } = await deployContract();
      
      await expect(membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: initialPrice
      }))
        .to.emit(membershipSubscription, "SubscriptionPurchased")
        .withArgs(subscriber1.address, 0, await time.latest() + oneMonth);
      
      expect(await membershipSubscription.balanceOf(subscriber1.address)).to.equal(1);
      expect(await membershipSubscription.isSubscriptionActive(0)).to.equal(true);
    });
    
    it("Should prevent purchasing multiple subscriptions", async function () {
      const { membershipSubscription, subscriber1 } = await deployContract();
      
      // Purchase first subscription
      await membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: initialPrice
      });
      
      // Try to purchase second subscription
      await expect(membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: initialPrice
      })).to.be.revertedWith("Already have an active subscription");
    });
    
    it("Should refund excess payment", async function () {
      const { membershipSubscription, subscriber1 } = await deployContract();
      const paymentAmount = initialPrice * BigInt(2); // Double the required amount
      
      const balanceBefore = await ethers.provider.getBalance(subscriber1.address);
      const tx = await membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: paymentAmount
      });
      
      // Get gas used for the transaction
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(subscriber1.address);
      const expectedBalance = balanceBefore - initialPrice - gasUsed;
      
      // Allow for a small margin of error due to gas estimation
      expect(balanceAfter).to.be.closeTo(expectedBalance, 1000000n);
    });
    
    it("Should track subscription expiration time", async function () {
      const { membershipSubscription, subscriber1 } = await deployContract();
      
      // Purchase subscription
      await membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: initialPrice
      });
      
      const currentTime = await time.latest();
      const expiration = await membershipSubscription.getSubscriptionExpiration(0);
      
      // Expiration should be approximately current time + 30 days
      expect(expiration).to.be.closeTo(
        BigInt(currentTime) + BigInt(oneMonth),
        5n // Allow small time variation
      );
    });
    
    it("Should correctly identify expired subscriptions", async function () {
      const { membershipSubscription, subscriber1 } = await deployContract();
      
      // Purchase subscription
      await membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: initialPrice
      });
      
      // Verify subscription is active
      expect(await membershipSubscription.isSubscriptionActive(0)).to.equal(true);
      
      // Fast forward time past subscription expiration
      await time.increase(oneMonth + 1);
      
      // Verify subscription is now expired
      expect(await membershipSubscription.isSubscriptionActive(0)).to.equal(false);
    });
    
    it("Should allow purchasing new subscription after expiration", async function () {
      const { membershipSubscription, subscriber1 } = await deployContract();
      
      // Purchase first subscription
      await membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: initialPrice
      });
      
      // Fast forward time past subscription expiration
      await time.increase(oneMonth + 1);
      
      // Burn the expired token (in a real scenario, user would need to transfer or burn)
      // For testing, we'll transfer to a burn address
      const burnAddress = "0x000000000000000000000000000000000000dEaD";
      await membershipSubscription.connect(subscriber1)["transferFrom(address,address,uint256)"](
        subscriber1.address, 
        burnAddress, 
        0
      );
      
      // Purchase new subscription
      await expect(membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: initialPrice
      })).to.not.be.reverted;
      
      // Check new token was issued
      expect(await membershipSubscription.balanceOf(subscriber1.address)).to.equal(1);
      expect(await membershipSubscription.isSubscriptionActive(1)).to.equal(true);
    });
  });
  
  describe("Admin Functions", function () {
    it("Should allow owner to update price", async function () {
      const { membershipSubscription, owner } = await deployContract();
      const newPrice = ethers.parseEther("0.02");
      
      await expect(membershipSubscription.connect(owner).updateSubscriptionPrice(newPrice))
        .to.emit(membershipSubscription, "PriceUpdated")
        .withArgs(initialPrice, newPrice);
      
      expect(await membershipSubscription.subscriptionPrice()).to.equal(newPrice);
    });
    
    it("Should allow owner to withdraw funds", async function () {
      const { membershipSubscription, owner, subscriber1 } = await deployContract();
      
      // Purchase subscription to add funds to contract
      await membershipSubscription.connect(subscriber1).purchaseSubscription({
        value: initialPrice
      });
      
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      
      // Withdraw funds
      const tx = await membershipSubscription.connect(owner).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      
      // Owner should receive the subscription payment minus gas
      expect(balanceAfter).to.equal(balanceBefore + initialPrice - gasUsed);
    });
  });
});