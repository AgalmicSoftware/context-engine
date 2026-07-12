// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CustomSBT.sol";

/// @title Context Engine SBT factory
/// @notice Deploys ERC-5192 / ERC-5484-aligned CustomSBT instances for new sessions.
contract SBTFactory {
    uint256 public sbtCount;

    event SBTCreated(address indexed sbtAddress);
    event SBTCreatedDeterministic(address indexed sbtAddress, bytes32 indexed salt);

    function _deriveMintMode(
        uint256 limitedNumber,
        bool hasPasswordMint,
        bytes32[] memory hashedPasswords,
        bytes32 groupPasswordHash,
        bool allowGroupPasswordHashInit
    ) internal pure returns (MySBT.MintMode) {
        bool hasHashedPasswords = hashedPasswords.length > 0;
        bool hasGroupSignerHash = groupPasswordHash != bytes32(0);

        if (allowGroupPasswordHashInit) {
            require(!hasGroupSignerHash, "Deferred group signer hash must start empty");
        }

        if (hasPasswordMint) {
            if (hasHashedPasswords) {
                require(!hasGroupSignerHash, "Password mint cannot also configure signer hash");
                require(!allowGroupPasswordHashInit, "Password mint cannot defer signer hash");
                return MySBT.MintMode.PasswordCommitReveal;
            }

            require(limitedNumber > 0, "Invite mint requires positive max tokens");
            require(hasGroupSignerHash || allowGroupPasswordHashInit, "Invite mint requires signer hash");
            return MySBT.MintMode.LimitedInviteSignature;
        }

        require(!hasHashedPasswords, "Public/group mint cannot preload passwords");

        if (hasGroupSignerHash || allowGroupPasswordHashInit) {
            return MySBT.MintMode.UnlimitedGroupSignature;
        }

        return MySBT.MintMode.PublicClaim;
    }

    function _buildCreationCode(
        string memory name,
        string memory symbol,
        uint256 limitedNumber,
        address adminAddress,
        uint256 mintingEndTime,
        bool hasPasswordMint,
        MySBT.BurnAuth burnAuth,
        bytes32[] memory hashedPasswords,
        string memory tokenURI,
        bytes32 groupPasswordHash,
        bool allowTokenURIInit,
        bool allowGroupPasswordHashInit
    ) internal pure returns (bytes memory) {
        MySBT.MintMode mintMode =
            _deriveMintMode(limitedNumber, hasPasswordMint, hashedPasswords, groupPasswordHash, allowGroupPasswordHashInit);
        return abi.encodePacked(
            type(MySBT).creationCode,
            abi.encode(
                name,
                symbol,
                limitedNumber,
                adminAddress,
                mintingEndTime,
                mintMode,
                burnAuth,
                hashedPasswords,
                tokenURI,
                groupPasswordHash,
                allowTokenURIInit,
                allowGroupPasswordHashInit
            )
        );
    }

    function _predictAddress(bytes32 salt, bytes memory creationCode) internal view returns (address) {
        bytes32 hash = keccak256(creationCode);
        bytes32 data = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, hash));
        return address(uint160(uint256(data)));
    }

    /// @notice Deploys a new SBT contract with standard constructor configuration.
    /// @dev The deployed contract stores immutable mint configuration and emits `SBTCreated`.
    /// @param name The ERC721 collection name.
    /// @param symbol The ERC721 collection symbol.
    /// @param limitedNumber The max token supply, or zero for uncapped minting.
    /// @param adminAddress The admin and owner address for the new SBT.
    /// @param mintingEndTime The mint cutoff timestamp, or zero for no deadline.
    /// @param hasPasswordMint Whether password-based minting is enabled.
    /// @param burnAuth The burn authorization mode for the new SBT.
    /// @param hashedPasswords The initial set of password hashes for password minting.
    /// @param tokenURI The collection-wide metadata URI.
    /// @param groupPasswordHash The invite signer hash for signature-based minting.
    function createSBT(
        string memory name,
        string memory symbol,
        uint256 limitedNumber,
        address adminAddress,
        uint256 mintingEndTime,
        bool hasPasswordMint,
        MySBT.BurnAuth burnAuth,
        bytes32[] memory hashedPasswords,
        string memory tokenURI,
        bytes32 groupPasswordHash
    ) external {
        MySBT.MintMode mintMode = _deriveMintMode(limitedNumber, hasPasswordMint, hashedPasswords, groupPasswordHash, false);
        MySBT newSBT = new MySBT(
            name,
            symbol,
            limitedNumber,
            adminAddress,
            mintingEndTime,
            mintMode,
            burnAuth,
            hashedPasswords,
            tokenURI,
            groupPasswordHash,
            false,
            false
        );
        sbtCount++;
        emit SBTCreated(address(newSBT));
    }

    /// @notice Deploys an SBT deterministically with `CREATE2`.
    /// @dev Emits both `SBTCreated` and `SBTCreatedDeterministic`.
    /// @param salt The `CREATE2` salt used to derive the deployment address.
    /// @param name The ERC721 collection name.
    /// @param symbol The ERC721 collection symbol.
    /// @param limitedNumber The max token supply, or zero for uncapped minting.
    /// @param adminAddress The admin and owner address for the new SBT.
    /// @param mintingEndTime The mint cutoff timestamp, or zero for no deadline.
    /// @param hasPasswordMint Whether password-based minting is enabled.
    /// @param burnAuth The burn authorization mode for the new SBT.
    /// @param hashedPasswords The initial set of password hashes for password minting.
    /// @param tokenURI The collection-wide metadata URI.
    /// @param groupPasswordHash The invite signer hash for signature-based minting.
    /// @return The deployed SBT contract address.
    function createSBTDeterministic(
        bytes32 salt,
        string memory name,
        string memory symbol,
        uint256 limitedNumber,
        address adminAddress,
        uint256 mintingEndTime,
        bool hasPasswordMint,
        MySBT.BurnAuth burnAuth,
        bytes32[] memory hashedPasswords,
        string memory tokenURI,
        bytes32 groupPasswordHash
    ) external returns (address) {
        MySBT.MintMode mintMode = _deriveMintMode(limitedNumber, hasPasswordMint, hashedPasswords, groupPasswordHash, false);
        MySBT newSBT = new MySBT{salt: salt}(
            name,
            symbol,
            limitedNumber,
            adminAddress,
            mintingEndTime,
            mintMode,
            burnAuth,
            hashedPasswords,
            tokenURI,
            groupPasswordHash,
            false,
            false
        );
        sbtCount++;
        emit SBTCreated(address(newSBT));
        emit SBTCreatedDeterministic(address(newSBT), salt);
        return address(newSBT);
    }

    /// @notice Deploys an SBT deterministically, then finalizes deferred metadata configuration.
    /// @dev The contract is created with token URI initialization enabled, and optionally with deferred
    /// group password hash initialization.
    /// @param salt The `CREATE2` salt used to derive the deployment address.
    /// @param name The ERC721 collection name.
    /// @param symbol The ERC721 collection symbol.
    /// @param limitedNumber The max token supply, or zero for uncapped minting.
    /// @param adminAddress The admin and owner address for the new SBT.
    /// @param mintingEndTime The mint cutoff timestamp, or zero for no deadline.
    /// @param hasPasswordMint Whether password-based minting is enabled.
    /// @param burnAuth The burn authorization mode for the new SBT.
    /// @param hashedPasswords The initial set of password hashes for password minting.
    /// @param finalTokenURI The token URI to initialize immediately after deployment.
    /// @param finalGroupPasswordHash The final invite signer hash to initialize when requested.
    /// @param initializeGroupPasswordHash Whether to defer group password hash initialization until after deploy.
    /// @return The deployed SBT contract address.
    function createSBTDeterministicConfigured(
        bytes32 salt,
        string memory name,
        string memory symbol,
        uint256 limitedNumber,
        address adminAddress,
        uint256 mintingEndTime,
        bool hasPasswordMint,
        MySBT.BurnAuth burnAuth,
        bytes32[] memory hashedPasswords,
        string memory finalTokenURI,
        bytes32 finalGroupPasswordHash,
        bool initializeGroupPasswordHash
    ) external returns (address) {
        require(adminAddress != address(0), "Configured deterministic deploy requires admin");
        require(msg.sender == adminAddress, "Configured deterministic deploy caller must be admin");
        MySBT.MintMode mintMode =
            _deriveMintMode(limitedNumber, hasPasswordMint, hashedPasswords, bytes32(0), initializeGroupPasswordHash);
        require(
            initializeGroupPasswordHash || finalGroupPasswordHash == bytes32(0),
            "Configured deterministic deploy requires deferred group password init"
        );
        if (initializeGroupPasswordHash) {
            require(finalGroupPasswordHash != bytes32(0), "Configured deterministic deploy requires final signer hash");
        }
        MySBT newSBT = new MySBT{salt: salt}(
            name,
            symbol,
            limitedNumber,
            adminAddress,
            mintingEndTime,
            mintMode,
            burnAuth,
            hashedPasswords,
            "",
            initializeGroupPasswordHash ? bytes32(0) : finalGroupPasswordHash,
            true,
            initializeGroupPasswordHash
        );
        newSBT.initializeTokenURI(finalTokenURI);
        if (initializeGroupPasswordHash) {
            newSBT.initializeGroupPasswordHash(finalGroupPasswordHash);
        }
        sbtCount++;
        emit SBTCreated(address(newSBT));
        emit SBTCreatedDeterministic(address(newSBT), salt);
        return address(newSBT);
    }

    /// @notice Predicts the deterministic address for a standard `CREATE2` SBT deployment.
    /// @dev Uses the same constructor payload as `createSBTDeterministic`.
    /// @param salt The `CREATE2` salt that would be used for deployment.
    /// @param name The ERC721 collection name.
    /// @param symbol The ERC721 collection symbol.
    /// @param limitedNumber The max token supply, or zero for uncapped minting.
    /// @param adminAddress The admin and owner address for the new SBT.
    /// @param mintingEndTime The mint cutoff timestamp, or zero for no deadline.
    /// @param hasPasswordMint Whether password-based minting is enabled.
    /// @param burnAuth The burn authorization mode for the new SBT.
    /// @param hashedPasswords The initial set of password hashes for password minting.
    /// @param tokenURI The collection-wide metadata URI.
    /// @param groupPasswordHash The invite signer hash for signature-based minting.
    /// @return The predicted deployment address.
    function predictSBTAddress(
        bytes32 salt,
        string memory name,
        string memory symbol,
        uint256 limitedNumber,
        address adminAddress,
        uint256 mintingEndTime,
        bool hasPasswordMint,
        MySBT.BurnAuth burnAuth,
        bytes32[] memory hashedPasswords,
        string memory tokenURI,
        bytes32 groupPasswordHash
    ) external view returns (address) {
        return _predictAddress(
            salt,
            _buildCreationCode(
                name,
                symbol,
                limitedNumber,
                adminAddress,
                mintingEndTime,
                hasPasswordMint,
                burnAuth,
                hashedPasswords,
                tokenURI,
                groupPasswordHash,
                false,
                false
            )
        );
    }

    /// @notice Predicts the deterministic address for a configured `CREATE2` deployment.
    /// @dev Uses the same constructor payload as `createSBTDeterministicConfigured` before post-deploy initialization.
    /// @param salt The `CREATE2` salt that would be used for deployment.
    /// @param name The ERC721 collection name.
    /// @param symbol The ERC721 collection symbol.
    /// @param limitedNumber The max token supply, or zero for uncapped minting.
    /// @param adminAddress The admin and owner address for the new SBT.
    /// @param mintingEndTime The mint cutoff timestamp, or zero for no deadline.
    /// @param hasPasswordMint Whether password-based minting is enabled.
    /// @param burnAuth The burn authorization mode for the new SBT.
    /// @param hashedPasswords The initial set of password hashes for password minting.
    /// @param initializeGroupPasswordHash Whether the deployment would defer group password hash initialization.
    /// @return The predicted deployment address.
    function predictConfiguredSBTAddress(
        bytes32 salt,
        string memory name,
        string memory symbol,
        uint256 limitedNumber,
        address adminAddress,
        uint256 mintingEndTime,
        bool hasPasswordMint,
        MySBT.BurnAuth burnAuth,
        bytes32[] memory hashedPasswords,
        bool initializeGroupPasswordHash
    ) external view returns (address) {
        return _predictAddress(
            salt,
            _buildCreationCode(
                name,
                symbol,
                limitedNumber,
                adminAddress,
                mintingEndTime,
                hasPasswordMint,
                burnAuth,
                hashedPasswords,
                "",
                bytes32(0),
                true,
                initializeGroupPasswordHash
            )
        );
    }
}
