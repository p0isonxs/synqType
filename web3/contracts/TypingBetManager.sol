// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract TypingBetManager {
    struct GameRoom {
        address host;
        uint256 betAmount;
        address[] players;
        mapping(address => bool) hasJoined;
        mapping(address => bool) hasFinished;
        mapping(address => uint256) finishTime;
        mapping(address => bool) refunded;
        uint256 createdAt;
        uint256 gameTimeLimit;
        bool gameEnded;
        address winner;
        uint256 totalPot;
        bool rewardClaimed;
        mapping(address => uint256) playerScores;
        bool resultDeclared; 
    }

    mapping(string => GameRoom) private rooms;
    mapping(string => bool) private roomExists;

    event RoomCreated(string roomId, address host, uint256 betAmount);
    event PlayerJoined(string roomId, address player);
    event PlayerFinished(string roomId, address player, uint256 time);
    event GameEnded(string roomId, address winner);
    event RewardClaimed(string roomId, address winner, uint256 amount);
    event GameResultDeclared(string roomId, address[] winners, uint256 highestScore);


    modifier onlyHost(string memory roomId) {
        require(msg.sender == rooms[roomId].host, "Not room host");
        _;
    }

    modifier gameExists(string memory roomId) {
        require(roomExists[roomId], "Room does not exist");
        _;
    }

    modifier onlyPlayer(string memory roomId) {
        require(rooms[roomId].hasJoined[msg.sender], "Not a player");
        _;
    }

    // ✅ SINGLE TRANSACTION: Create room and place host's bet in one go
    function createRoomAndBet(string memory roomId, uint256 gameTimeLimit) external payable {
        require(!roomExists[roomId], "Room already exists");
        require(msg.value > 0, "Bet amount must be > 0");
        require(gameTimeLimit >= 30 && gameTimeLimit <= 300, "Time limit 30-300s");

        GameRoom storage room = rooms[roomId];
        room.host = msg.sender;
        room.betAmount = msg.value; // Host's bet amount becomes the required bet
        room.gameTimeLimit = gameTimeLimit;
        room.createdAt = block.timestamp;
        
        // ✅ HOST AUTOMATICALLY JOINS BETTING POOL
        room.players.push(msg.sender);
        room.hasJoined[msg.sender] = true;
        room.totalPot = msg.value;
        
        roomExists[roomId] = true;

        emit RoomCreated(roomId, msg.sender, msg.value);
        emit PlayerJoined(roomId, msg.sender);
    }

    // ✅ SINGLE TRANSACTION: Join room and place bet
    function joinRoom(string memory roomId) external payable gameExists(roomId) {
        GameRoom storage room = rooms[roomId];
        require(!room.gameEnded, "Game ended");
        require(!room.hasJoined[msg.sender], "Already joined");
        require(msg.value == room.betAmount, "Incorrect bet amount");

        room.players.push(msg.sender);
        room.hasJoined[msg.sender] = true;
        room.totalPot += msg.value;

        emit PlayerJoined(roomId, msg.sender);
    }

    // ✅ NO SEPARATE START TRANSACTION - Game starts when first player finishes
    function declareFinished(string memory roomId) external gameExists(roomId) onlyPlayer(roomId) {
        GameRoom storage room = rooms[roomId];
        require(!room.gameEnded, "Game already ended");
        require(!room.hasFinished[msg.sender], "Already finished");
        require(room.players.length >= 2, "Need at least 2 players");

        uint256 finishDuration = block.timestamp - room.createdAt;
        room.hasFinished[msg.sender] = true;
        room.finishTime[msg.sender] = finishDuration;

        emit PlayerFinished(roomId, msg.sender, finishDuration);

        // ✅ FIRST TO FINISH WINS AND GETS PAID AUTOMATICALLY
        if (room.winner == address(0)) {
            room.winner = msg.sender;
            room.gameEnded = true;
            
            // ✅ INSTANT PAYOUT - No separate claim transaction needed
            uint256 amount = room.totalPot;
            if (amount > 0 && amount <= address(this).balance) {
                room.rewardClaimed = true;
                
                (bool success, ) = payable(msg.sender).call{value: amount}("");
                require(success, "Winner payout failed");
                
                emit RewardClaimed(roomId, msg.sender, amount);
            }
            
            emit GameEnded(roomId, msg.sender);
        }
    }

    // ✅ EMERGENCY: Handle time-up scenarios (can be called by anyone)
    function handleTimeUp(string memory roomId) external gameExists(roomId) {
        GameRoom storage room = rooms[roomId];
        require(!room.gameEnded, "Game already ended");
        require(block.timestamp > room.createdAt + room.gameTimeLimit, "Time not up yet");

        address fastest;
        uint256 bestTime = type(uint256).max;

        // Find fastest player who finished
        for (uint256 i = 0; i < room.players.length; i++) {
            address player = room.players[i];
            if (room.hasFinished[player] && room.finishTime[player] < bestTime) {
                bestTime = room.finishTime[player];
                fastest = player;
            }
        }

        room.gameEnded = true;
        room.winner = fastest;

        // ✅ AUTOMATIC PAYOUT if someone finished
        if (fastest != address(0) && !room.rewardClaimed) {
            uint256 amount = room.totalPot;
            if (amount > 0 && amount <= address(this).balance) {
                room.rewardClaimed = true;
                
                (bool success, ) = payable(fastest).call{value: amount}("");
                require(success, "Winner payout failed");
                
                emit RewardClaimed(roomId, fastest, amount);
            }
        }

        emit GameEnded(roomId, fastest);
    }

    // ✅ EMERGENCY REFUND: If host abandons room before anyone finishes
    function emergencyRefund(string memory roomId) external gameExists(roomId) onlyPlayer(roomId) {
        GameRoom storage room = rooms[roomId];
        require(!room.gameEnded, "Game ended");
        require(block.timestamp > room.createdAt + 30 minutes, "Refund only after 30 minutes");
        require(!room.refunded[msg.sender], "Already refunded");
        
        // Check if no one has finished yet
        bool anyoneFinished = false;
        for (uint256 i = 0; i < room.players.length; i++) {
            if (room.hasFinished[room.players[i]]) {
                anyoneFinished = true;
                break;
            }
        }
        require(!anyoneFinished, "Game already in progress");

        room.refunded[msg.sender] = true;
        room.hasJoined[msg.sender] = false;

        uint256 refundAmount = room.betAmount;
        room.totalPot -= refundAmount;

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Refund failed");
    }

    // ✅ VIEW FUNCTIONS
    function getRoomInfo(string memory roomId) external view returns (
        address host,
        uint256 betAmount,
        uint256 playerCount,
        bool ended,
        address winner,
        uint256 pot,
        uint256 timeLimit,
        uint256 createdAt
    ) {
        GameRoom storage room = rooms[roomId];
        return (
            room.host,
            room.betAmount,
            room.players.length,
            room.gameEnded,
            room.winner,
            room.totalPot,
            room.gameTimeLimit,
            room.createdAt
        );
    }

    function hasJoined(string memory roomId, address player) external view returns (bool) {
        return rooms[roomId].hasJoined[player];
    }

    function hasFinished(string memory roomId, address player) external view returns (bool) {
        return rooms[roomId].hasFinished[player];
    }

    function finishTime(string memory roomId, address player) external view returns (uint256) {
        return rooms[roomId].finishTime[player];
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // ✅ GAME STATUS: Check if game can start (frontend only)
    function canGameStart(string memory roomId) external view returns (bool) {
        GameRoom storage room = rooms[roomId];
        return room.players.length >= 2 && !room.gameEnded;
    }

    function declareGameResult(
    string memory roomId,
    address[] calldata players,
    uint256[] calldata scores
) external gameExists(roomId) {
    require(players.length == scores.length, "Players and scores length mismatch");
    
    GameRoom storage room = rooms[roomId];
    require(block.timestamp > room.createdAt + room.gameTimeLimit, "Game not ended yet");
    require(!room.resultDeclared, "Result already declared");
    require(!room.rewardClaimed, "Reward already claimed");

    uint256 highestScore = 0;

    // Set scores dan cari highest score
    for (uint256 i = 0; i < players.length; i++) {
        require(room.hasJoined[players[i]], "Player did not join");
        room.playerScores[players[i]] = scores[i];
        if (scores[i] > highestScore) {
            highestScore = scores[i];
        }
    }

    // Tentukan pemenang berdasarkan highestScore
    address[] memory winnersTemp = new address[](players.length);
    uint256 winnerCount = 0;

    for (uint256 i = 0; i < players.length; i++) {
        if (room.playerScores[players[i]] == highestScore && highestScore > 0) {
            winnersTemp[winnerCount] = players[i];
            winnerCount++;
        }
    }

    require(winnerCount > 0, "No winners - use refund mechanism");

    // ✅ Bagikan pot secara merata jika seri
    uint256 rewardPerWinner = room.totalPot / winnerCount;

    for (uint256 i = 0; i < winnerCount; i++) {
        (bool success, ) = payable(winnersTemp[i]).call{value: rewardPerWinner}("");
        require(success, "Payout failed");
    }

    room.resultDeclared = true;
    room.rewardClaimed = true;
    room.gameEnded = true;

    emit GameResultDeclared(roomId, winnersTemp, highestScore);
    emit GameEnded(roomId, winnerCount == 1 ? winnersTemp[0] : address(0));
    emit RewardClaimed(roomId, winnerCount == 1 ? winnersTemp[0] : address(0), room.totalPot);
}

}