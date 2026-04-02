const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const hre = require("hardhat");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("TypingBetManager", function () {
  async function deployManagerFixture() {
    const [host, playerOne, outsider] = await hre.ethers.getSigners();
    const TypingBetManager = await hre.ethers.getContractFactory("TypingBetManager");
    const manager = await TypingBetManager.deploy();
    await manager.waitForDeployment();

    return {
      manager,
      host,
      playerOne,
      outsider,
      roomId: "room-1",
      betAmount: hre.ethers.parseEther("1"),
      timeLimit: 60,
      maxPlayers: 2,
    };
  }

  async function startedRoomFixture() {
    const fixture = await deployManagerFixture();
    const { manager, host, playerOne, roomId, betAmount, timeLimit, maxPlayers } =
      fixture;

    await manager
      .connect(host)
      .createRoomAndBet(roomId, timeLimit, maxPlayers, { value: betAmount });
    await manager.connect(playerOne).joinRoom(roomId, { value: betAmount });
    await manager.connect(host).startGame(roomId);

    return fixture;
  }

  it("blocks new players from joining after the game starts", async function () {
    const { manager, outsider, roomId, betAmount } = await loadFixture(
      startedRoomFixture
    );

    await expect(
      manager.connect(outsider).joinRoom(roomId, { value: betAmount })
    ).to.be.revertedWith("Game already started");
  });

  it("allows only the host to declare the game result", async function () {
    const { manager, host, playerOne, roomId } = await loadFixture(
      startedRoomFixture
    );

    await expect(
      manager
        .connect(playerOne)
        .declareGameResult(roomId, [host.address, playerOne.address], [10, 8])
    ).to.be.revertedWith("Not room host");
  });

  it("rejects incomplete or forged result rosters", async function () {
    const { manager, host, playerOne, outsider, roomId } = await loadFixture(
      startedRoomFixture
    );

    await expect(
      manager.connect(host).declareGameResult(roomId, [host.address], [10])
    ).to.be.revertedWith("Incomplete player roster");

    await expect(
      manager
        .connect(host)
        .declareGameResult(roomId, [host.address, outsider.address], [10, 8])
    ).to.be.revertedWith("Player did not join");

    await expect(
      manager
        .connect(host)
        .declareGameResult(roomId, [host.address, playerOne.address], [10, 8])
    ).not.to.be.reverted;
  });

  it("tracks finish time from the real on-chain start, not room creation", async function () {
    const { manager, host, playerOne, roomId, betAmount, timeLimit, maxPlayers } =
      await loadFixture(deployManagerFixture);

    await manager
      .connect(host)
      .createRoomAndBet(roomId, timeLimit, maxPlayers, { value: betAmount });

    const createdRoomInfo = await manager.getRoomInfo(roomId);
    const createdAt = createdRoomInfo[9];

    await time.increase(300);
    await manager.connect(playerOne).joinRoom(roomId, { value: betAmount });
    await manager.connect(host).startGame(roomId);

    const startedRoomInfo = await manager.getRoomInfo(roomId);
    const startedAt = startedRoomInfo[10];

    expect(startedAt).to.be.greaterThan(createdAt);

    await time.increaseTo(startedAt + 10n);
    await manager.connect(playerOne).declareFinished(roomId);

    const finishTime = await manager.finishTime(roomId, playerOne.address);
    expect(finishTime).to.be.at.least(10n);
    expect(finishTime).to.be.lessThan(20n);
  });

  it("splits the pot on a draw instead of locking funds", async function () {
    const { manager, host, playerOne, roomId, betAmount } = await loadFixture(
      startedRoomFixture
    );

    const playerOneBalanceBefore = await hre.ethers.provider.getBalance(
      playerOne.address
    );

    await manager
      .connect(host)
      .declareGameResult(roomId, [host.address, playerOne.address], [5, 5]);

    const playerOneBalanceAfter = await hre.ethers.provider.getBalance(
      playerOne.address
    );
    const roomInfo = await manager.getRoomInfo(roomId);

    expect(playerOneBalanceAfter - playerOneBalanceBefore).to.equal(betAmount);
    expect(roomInfo[6]).to.equal(ZERO_ADDRESS);
    expect(await hre.ethers.provider.getBalance(manager.target)).to.equal(0n);
  });

  it("refunds the room after the result grace period expires", async function () {
    const { manager, host, playerOne, outsider, roomId, betAmount, timeLimit } =
      await loadFixture(startedRoomFixture);

    const playerOneBalanceBefore = await hre.ethers.provider.getBalance(
      playerOne.address
    );
    const roomInfo = await manager.getRoomInfo(roomId);
    const startedAt = roomInfo[10];

    await time.increaseTo(startedAt + BigInt(timeLimit) + 121n);
    await manager.connect(outsider).handleTimeUp(roomId);

    const playerOneBalanceAfter = await hre.ethers.provider.getBalance(
      playerOne.address
    );
    const updatedRoomInfo = await manager.getRoomInfo(roomId);

    expect(playerOneBalanceAfter - playerOneBalanceBefore).to.equal(betAmount);
    expect(updatedRoomInfo[5]).to.equal(true);
    expect(updatedRoomInfo[6]).to.equal(ZERO_ADDRESS);
    expect(await hre.ethers.provider.getBalance(manager.target)).to.equal(0n);
  });
});
