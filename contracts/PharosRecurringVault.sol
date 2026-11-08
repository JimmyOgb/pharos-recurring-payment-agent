// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20Minimal
 * @dev Interface for standard ERC-20 transferFrom operations
 */
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PharosRecurringVault
 * @notice Auditable, non-custodial recurring payment vault for Pharos ecosystem.
 * @dev Enforces deterministic time intervals, recipient boundaries, and user spending limits.
 *      Users retain full custody and can revoke authorizations at any time.
 */
contract PharosRecurringVault {
    enum Frequency { WEEKLY, MONTHLY }

    struct RecurringPlan {
        address subscriber;
        address recipient;
        address token;
        uint256 amountPerCycle;
        uint256 intervalSeconds;
        uint256 nextDueTime;
        uint256 totalExecutedCycles;
        bool isActive;
    }

    uint256 private planCounter;
    mapping(uint256 => RecurringPlan) public plans;
    mapping(address => uint256[]) private userPlanIds;

    event PlanCreated(uint256 indexed planId, address indexed subscriber, address indexed recipient, address token, uint256 amount, uint256 interval);
    event RecurringPaymentExecuted(uint256 indexed planId, address indexed subscriber, address indexed recipient, uint256 amount, uint256 cycleIndex);
    event PlanPaused(uint256 indexed planId);
    event PlanResumed(uint256 indexed planId);
    event PlanCancelled(uint256 indexed planId);

    modifier onlySubscriber(uint256 planId) {
        require(plans[planId].subscriber == msg.sender, "Caller is not subscriber");
        _;
    }

    /**
     * @notice Registers a new recurring payment schedule.
     * @param recipient Target receiving address.
     * @param token ERC-20 token address.
     * @param amount Amount to transfer per cycle in base units.
     * @param frequency WEEKLY (604800s) or MONTHLY (2592000s).
     * @param startTime First due timestamp.
     */
    function createPlan(
        address recipient,
        address token,
        uint256 amount,
        Frequency frequency,
        uint256 startTime
    ) external returns (uint256 planId) {
        require(recipient != address(0), "Invalid recipient");
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be > 0");

        uint256 interval = frequency == Frequency.WEEKLY ? 7 days : 30 days;
        uint256 firstDue = startTime > block.timestamp ? startTime : block.timestamp;

        planCounter++;
        planId = planCounter;

        plans[planId] = RecurringPlan({
            subscriber: msg.sender,
            recipient: recipient,
            token: token,
            amountPerCycle: amount,
            intervalSeconds: interval,
            nextDueTime: firstDue,
            totalExecutedCycles: 0,
            isActive: true
        });

        userPlanIds[msg.sender].push(planId);

        emit PlanCreated(planId, msg.sender, recipient, token, amount, interval);
    }

    /**
     * @notice Executes a due recurring payment. Callable by anyone (keeper, relayer, user).
     * @dev Strictly enforces time interval, allowance, and registered recipient.
     */
    function executeRecurringPayment(uint256 planId) external returns (bool) {
        RecurringPlan storage plan = plans[planId];
        require(plan.isActive, "Plan is not active");
        require(block.timestamp >= plan.nextDueTime, "Payment not due yet");

        IERC20Minimal tokenContract = IERC20Minimal(plan.token);
        require(tokenContract.allowance(plan.subscriber, address(this)) >= plan.amountPerCycle, "Insufficient allowance");
        require(tokenContract.balanceOf(plan.subscriber) >= plan.amountPerCycle, "Insufficient subscriber balance");

        // Advance due time prior to external call (Reentrancy defense)
        plan.nextDueTime += plan.intervalSeconds;
        plan.totalExecutedCycles++;

        bool success = tokenContract.transferFrom(plan.subscriber, plan.recipient, plan.amountPerCycle);
        require(success, "Token transfer failed");

        emit RecurringPaymentExecuted(planId, plan.subscriber, plan.recipient, plan.amountPerCycle, plan.totalExecutedCycles);
        return true;
    }

    function pausePlan(uint256 planId) external onlySubscriber(planId) {
        plans[planId].isActive = false;
        emit PlanPaused(planId);
    }

    function resumePlan(uint256 planId) external onlySubscriber(planId) {
        plans[planId].isActive = true;
        emit PlanResumed(planId);
    }

    function cancelPlan(uint256 planId) external onlySubscriber(planId) {
        delete plans[planId];
        emit PlanCancelled(planId);
    }

    function getUserPlans(address user) external view returns (uint256[] memory) {
        return userPlanIds[user];
    }
}
