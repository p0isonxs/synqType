// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract TypingBetManager {
    uint256 private constant MIN_GAME_TIME = 30;
    uint256 private constant MAX_GAME_TIME = 300;
    uint256 private constant MIN_PLAYERS = 2;
    uint256 private constant MAX_PLAYERS = 6;
    uint256 private constant RESULT_GRACE_PERIOD = 2 minutes;

    struct GameRoom {
        address host;
        uint256 betAmount;
        address[] players;
        mapping(address => bool) hasJoined;
        mapping(address => bool) hasFinished;
        mapping(address => uint256) finishTime;
        mapping(address => bool) refunded;
        uint256 createdAt;
        uint256 startedAt;
        uint256 gameTimeLimit;
        uint256 maxPlayers;
        bool gameStarted;
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
    event GameStarted(string roomId, uint256 startedAt);
    event PlayerFinished(string roomId, address player, uint256 time);
    event GameEnded(string roomId, address winner);
    event RewardClaimed(string roomId, address winner, uint256 amount);
    event GameResultDeclared(string roomId, address[] winners, uint256 highestScore);
    event TimeoutRefunded(string roomId, uint256 refundPerPlayer, uint256 playerCount);

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

    function createRoomAndBet(
        string memory roomId,
        uint256 gameTimeLimit,
        uint256 maxPlayers
    ) external payable {
        require(!roomExists[roomId], "Room already exists");
        require(msg.value > 0, "Bet amount must be > 0");
        require(
            gameTimeLimit >= MIN_GAME_TIME && gameTimeLimit <= MAX_GAME_TIME,
            "Time limit 30-300s"
        );
        require(
            maxPlayers >= MIN_PLAYERS && maxPlayers <= MAX_PLAYERS,
            "Max players 2-6"
        );

        GameRoom storage room = rooms[roomId];
        room.host = msg.sender;
        room.betAmount = msg.value;
        room.gameTimeLimit = gameTimeLimit;
        room.maxPlayers = maxPlayers;
        room.createdAt = block.timestamp;

        room.players.push(msg.sender);
        room.hasJoined[msg.sender] = true;
        room.totalPot = msg.value;
        roomExists[roomId] = true;

        emit RoomCreated(roomId, msg.sender, msg.value);
        emit PlayerJoined(roomId, msg.sender);
    }

    function joinRoom(string memory roomId) external payable gameExists(roomId) {
        GameRoom storage room = rooms[roomId];
        require(!room.gameEnded, "Game ended");
        require(!room.gameStarted, "Game already started");
        require(!room.hasJoined[msg.sender], "Already joined");
        require(msg.value == room.betAmount, "Incorrect bet amount");
        require(room.players.length < room.maxPlayers, "Room is full");

        room.players.push(msg.sender);
        room.hasJoined[msg.sender] = true;
        room.totalPot += msg.value;

        emit PlayerJoined(roomId, msg.sender);
    }

    function startGame(string memory roomId)
        external
        gameExists(roomId)
        onlyHost(roomId)
    {
        GameRoom storage room = rooms[roomId];
        require(!room.gameStarted, "Game already started");
        require(!room.gameEnded, "Game already ended");
        require(room.players.length == room.maxPlayers, "Room not full");
        require(room.players.length >= MIN_PLAYERS, "Need at least 2 players");

        room.gameStarted = true;
        room.startedAt = block.timestamp;

        emit GameStarted(roomId, room.startedAt);
    }

    function declareFinished(string memory roomId)
        external
        gameExists(roomId)
        onlyPlayer(roomId)
    {
        GameRoom storage room = rooms[roomId];
        require(room.gameStarted, "Game not started");
        require(!room.gameEnded, "Game already ended");
        require(!room.hasFinished[msg.sender], "Already finished");

        uint256 finishDuration = block.timestamp - room.startedAt;
        room.hasFinished[msg.sender] = true;
        room.finishTime[msg.sender] = finishDuration;

        emit PlayerFinished(roomId, msg.sender, finishDuration);
    }

    function handleTimeUp(string memory roomId) external gameExists(roomId) {
        GameRoom storage room = rooms[roomId];
        require(room.gameStarted, "Game not started");
        require(!room.gameEnded, "Game already ended");
        require(!room.resultDeclared, "Result already declared");
        require(
            block.timestamp > room.startedAt + room.gameTimeLimit + RESULT_GRACE_PERIOD,
            "Result grace period not over"
        );

        uint256 playerCount = room.players.length;
        require(playerCount > 0, "No players to refund");

        uint256 refundPerPlayer = room.totalPot / playerCount;
        uint256 payoutTotal = refundPerPlayer * playerCount;

        room.rewardClaimed = true;
        room.gameEnded = true;
        room.winner = address(0);

        for (uint256 i = 0; i < playerCount; i++) {
            address player = room.players[i];
            if (!room.refunded[player]) {
                room.refunded[player] = true;

                if (refundPerPlayer > 0) {
                    (bool success, ) = payable(player).call{value: refundPerPlayer}("");
                    require(success, "Refund failed");
                }
            }
        }

        emit TimeoutRefunded(roomId, refundPerPlayer, playerCount);
        emit RewardClaimed(roomId, address(0), payoutTotal);
        emit GameEnded(roomId, address(0));
    }

    function emergencyRefund(string memory roomId)
        external
        gameExists(roomId)
        onlyPlayer(roomId)
    {
        GameRoom storage room = rooms[roomId];
        require(!room.gameEnded, "Game ended");
        require(!room.gameStarted, "Game already started");
        require(block.timestamp > room.createdAt + 30 minutes, "Refund only after 30 minutes");
        require(!room.refunded[msg.sender], "Already refunded");

        room.refunded[msg.sender] = true;
        room.hasJoined[msg.sender] = false;
        _removePlayer(room, msg.sender);

        uint256 refundAmount = room.betAmount;
        room.totalPot -= refundAmount;

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        require(success, "Refund failed");
    }

    function getRoomInfo(string memory roomId)
        external
        view
        returns (
            address host,
            uint256 betAmount,
            uint256 playerCount,
            uint256 maxPlayers,
            bool started,
            bool ended,
            address winner,
            uint256 pot,
            uint256 timeLimit,
            uint256 createdAt,
            uint256 startedAt
        )
    {
        GameRoom storage room = rooms[roomId];
        return (
            room.host,
            room.betAmount,
            room.players.length,
            room.maxPlayers,
            room.gameStarted,
            room.gameEnded,
            room.winner,
            room.totalPot,
            room.gameTimeLimit,
            room.createdAt,
            room.startedAt
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

    function canGameStart(string memory roomId) external view returns (bool) {
        GameRoom storage room = rooms[roomId];
        return
            room.players.length == room.maxPlayers &&
            room.players.length >= MIN_PLAYERS &&
            !room.gameStarted &&
            !room.gameEnded;
    }

    function declareGameResult(
        string memory roomId,
        address[] calldata players,
        uint256[] calldata scores
    ) external gameExists(roomId) onlyHost(roomId) {
        require(players.length == scores.length, "Players and scores length mismatch");

        GameRoom storage room = rooms[roomId];
        require(room.gameStarted, "Game not started");
        require(!room.gameEnded, "Game already ended");
        require(!room.resultDeclared, "Result already declared");
        require(!room.rewardClaimed, "Reward already claimed");
        require(players.length == room.players.length, "Incomplete player roster");

        _validateDeclaredPlayers(room, players);

        uint256 highestScore = 0;
        for (uint256 i = 0; i < players.length; i++) {
            room.playerScores[players[i]] = scores[i];
            if (scores[i] > highestScore) {
                highestScore = scores[i];
            }
        }

        address[] memory winnersTemp = new address[](players.length);
        uint256 winnerCount = 0;

        for (uint256 i = 0; i < players.length; i++) {
            if (room.playerScores[players[i]] == highestScore) {
                winnersTemp[winnerCount] = players[i];
                winnerCount++;
            }
        }

        require(winnerCount > 0, "No winners found");

        uint256 rewardPerWinner = room.totalPot / winnerCount;
        uint256 remainder = room.totalPot % winnerCount;
        address[] memory winners = new address[](winnerCount);

        for (uint256 i = 0; i < winnerCount; i++) {
            winners[i] = winnersTemp[i];

            uint256 payout = rewardPerWinner;
            if (i == 0 && remainder > 0) {
                payout += remainder;
            }

            if (payout > 0) {
                (bool success, ) = payable(winners[i]).call{value: payout}("");
                require(success, "Payout failed");
            }
        }

        room.resultDeclared = true;
        room.rewardClaimed = true;
        room.gameEnded = true;
        room.winner = winnerCount == 1 ? winners[0] : address(0);

        emit GameResultDeclared(roomId, winners, highestScore);
        emit GameEnded(roomId, room.winner);
        emit RewardClaimed(roomId, room.winner, room.totalPot);
    }

    function _removePlayer(GameRoom storage room, address player) internal {
        uint256 playerCount = room.players.length;

        for (uint256 i = 0; i < playerCount; i++) {
            if (room.players[i] == player) {
                room.players[i] = room.players[playerCount - 1];
                room.players.pop();
                return;
            }
        }
    }

    function _validateDeclaredPlayers(
        GameRoom storage room,
        address[] calldata players
    ) internal view {
        for (uint256 i = 0; i < players.length; i++) {
            require(room.hasJoined[players[i]], "Player did not join");

            for (uint256 j = 0; j < i; j++) {
                require(players[j] != players[i], "Duplicate player");
            }
        }

        for (uint256 i = 0; i < room.players.length; i++) {
            bool found = false;

            for (uint256 j = 0; j < players.length; j++) {
                if (players[j] == room.players[i]) {
                    found = true;
                    break;
                }
            }

            require(found, "Missing joined player");
        }
    }
}
