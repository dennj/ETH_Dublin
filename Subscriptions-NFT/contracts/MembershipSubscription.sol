// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MembershipSubscription
 * @dev A contract for managing time-based membership subscriptions
 */
contract MembershipSubscription is ERC721, ERC721Enumerable, Ownable {
    // Membership details
    uint256 public subscriptionPrice;
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;
    
    // Mapping from token ID to expiration timestamp
    mapping(uint256 => uint256) private _expirationTimes;
    
    // Counter for token IDs
    uint256 private _nextTokenId;
    
    // Events
    event SubscriptionPurchased(address indexed subscriber, uint256 indexed tokenId, uint256 expiresAt);
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    
    constructor(uint256 initialPrice) ERC721("MembershipSubscription", "MSUB") Ownable(msg.sender) {
        subscriptionPrice = initialPrice;
    }
    
    /**
     * @dev Purchase a new membership subscription
     */
    function purchaseSubscription() external payable {
        require(msg.value >= subscriptionPrice, "Insufficient payment");
        require(balanceOf(msg.sender) == 0, "Already have an active subscription");
        
        uint256 tokenId = _nextTokenId++;
        uint256 expiresAt = block.timestamp + SUBSCRIPTION_DURATION;
        
        _safeMint(msg.sender, tokenId);
        _expirationTimes[tokenId] = expiresAt;
        
        emit SubscriptionPurchased(msg.sender, tokenId, expiresAt);
        
        // Refund excess payment if any
        if (msg.value > subscriptionPrice) {
            payable(msg.sender).transfer(msg.value - subscriptionPrice);
        }
    }
    
    /**
     * @dev Check if a subscription is currently active
     * @param tokenId The token ID to check
     * @return bool Whether the subscription is active
     */
    function isSubscriptionActive(uint256 tokenId) public view returns (bool) {
        require(_exists(tokenId), "Subscription does not exist");
        return _expirationTimes[tokenId] > block.timestamp;
    }
    
    /**
     * @dev Get the expiration time of a subscription
     * @param tokenId The token ID to check
     * @return uint256 The timestamp when the subscription expires
     */
    function getSubscriptionExpiration(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "Subscription does not exist");
        return _expirationTimes[tokenId];
    }
    
    /**
     * @dev Update the subscription price (only owner)
     * @param newPrice The new price for subscriptions
     */
    function updateSubscriptionPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = subscriptionPrice;
        subscriptionPrice = newPrice;
        emit PriceUpdated(oldPrice, newPrice);
    }
    
    /**
     * @dev Withdraw contract funds (only owner)
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
    
    // The following functions are overrides required by Solidity
    
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}