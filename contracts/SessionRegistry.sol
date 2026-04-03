pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SessionRegistry
/// @notice On-chain registry for sessions. Stores minimal on-chain fields + Arweave metadata URIs.
contract SessionRegistry is Ownable {
    enum GateMode {
        Any,
        All
    } // Any = OR, All = AND

    uint256 public constant SESSION_CREATION_FEE = 0.0001 ether;

    struct ResourceGate {
        address[] sbtAddresses;
        uint256 chainId;
        uint256 perMemberLimit; // per-member spend limit (units defined off-chain)
        GateMode mode;
    }

    struct Session {
        bool exists;
        bytes16 sessionId;
        string slug;
        uint256 chainId;
        string metadataURI;
        string encryptedMetadataURI;
        address admin;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct SessionFieldInput {
        string key;
        string value;
    }

    struct ResourceGateInput {
        string resourceKey;
        address[] sbtAddresses;
        uint256 chainId;
        uint8 mode;
        uint256 perMemberLimit;
    }

    mapping(bytes32 => Session) private sessions;
    mapping(bytes16 => bytes32) private sessionIdToSlugHash;
    mapping(bytes32 => uint256) private sessionIndex; // 1-based index
    bytes32[] private sessionSlugs;
    mapping(bytes32 => mapping(bytes32 => ResourceGate)) private resourceGates; // slugHash => resourceHash => gate
    mapping(bytes32 => mapping(bytes32 => string)) private sessionFields; // slugHash => fieldHash => value

    event SessionCreated(
        bytes16 indexed sessionId,
        bytes32 indexed slugHash,
        string slug,
        uint256 chainId,
        string metadataURI,
        string encryptedMetadataURI
    );
    event SessionMetadataUpdated(bytes32 indexed slugHash, string metadataURI, string encryptedMetadataURI);
    event SessionChainUpdated(bytes32 indexed slugHash, uint256 chainId);
    event SessionAdminUpdated(bytes32 indexed slugHash, address admin);
    event ResourceGateUpdated(
        bytes32 indexed slugHash, string resourceKey, uint256 chainId, GateMode mode, uint256 perMemberLimit
    );
    event SessionFieldUpdated(bytes32 indexed slugHash, string fieldKey, string value);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function _slugHash(string memory slug) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(slug));
    }

    function _resourceHash(string memory resourceKey) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(resourceKey));
    }

    function _fieldHash(string memory fieldKey) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(fieldKey));
    }

    function _isAdmin(bytes32 slugHash) internal view returns (bool) {
        address admin = sessions[slugHash].admin;
        return admin != address(0) && msg.sender == admin;
    }

    /// @notice Checks whether a session slug has already been registered.
    /// @dev Slugs are normalized only by exact string bytes before hashing.
    /// @param slug The human-readable session slug to check.
    /// @return True when a session exists for the provided slug.
    function sessionExists(string calldata slug) external view returns (bool) {
        bytes32 slugHash = _slugHash(slug);
        return sessions[slugHash].exists;
    }

    /// @notice Checks whether a session ID has already been registered.
    /// @dev Session IDs are unique across the registry.
    /// @param sessionId The session identifier to check.
    /// @return True when a session exists for the provided ID.
    function sessionIdExists(bytes16 sessionId) external view returns (bool) {
        return sessionIdToSlugHash[sessionId] != bytes32(0);
    }

    /// @notice Returns the number of registered sessions.
    /// @dev The count matches the length of the internal slug index array.
    /// @return The total number of sessions stored by the registry.
    function getSessionCount() external view returns (uint256) {
        return sessionSlugs.length;
    }

    /// @notice Returns the slug stored at a given registry index.
    /// @dev Indices are zero-based and follow insertion order.
    /// @param idx The zero-based position in the session index.
    /// @return The slug stored at the requested index.
    function getSessionSlugByIndex(uint256 idx) external view returns (string memory) {
        require(idx < sessionSlugs.length, "index out of range");
        bytes32 slugHash = sessionSlugs[idx];
        return sessions[slugHash].slug;
    }

    /// @notice Returns the stored session record for a slug.
    /// @dev Reverts when the slug has not been registered.
    /// @param slug The session slug to look up.
    /// @return The stored session slug.
    /// @return The configured chain ID.
    /// @return The public metadata URI.
    /// @return The encrypted metadata URI.
    /// @return The current session admin.
    /// @return The session creation timestamp.
    /// @return The last update timestamp.
    /// @return The session ID.
    function getSessionBySlug(string calldata slug)
        external
        view
        returns (string memory, uint256, string memory, string memory, address, uint256, uint256, bytes16)
    {
        bytes32 slugHash = _slugHash(slug);
        Session storage s = sessions[slugHash];
        require(s.exists, "session not found");
        return
            (s.slug, s.chainId, s.metadataURI, s.encryptedMetadataURI, s.admin, s.createdAt, s.updatedAt, s.sessionId);
    }

    /// @notice Returns the stored session record for a slug hash.
    /// @dev Reverts when the slug hash has not been registered.
    /// @param slugHash The keccak256 hash of the session slug.
    /// @return The stored session slug.
    /// @return The configured chain ID.
    /// @return The public metadata URI.
    /// @return The encrypted metadata URI.
    /// @return The current session admin.
    /// @return The session creation timestamp.
    /// @return The last update timestamp.
    /// @return The session ID.
    function getSessionByHash(bytes32 slugHash)
        external
        view
        returns (string memory, uint256, string memory, string memory, address, uint256, uint256, bytes16)
    {
        Session storage s = sessions[slugHash];
        require(s.exists, "session not found");
        return
            (s.slug, s.chainId, s.metadataURI, s.encryptedMetadataURI, s.admin, s.createdAt, s.updatedAt, s.sessionId);
    }

    /// @notice Returns the stored session record for a session ID.
    /// @dev Reverts when the session ID has not been registered.
    /// @param sessionId The session identifier to look up.
    /// @return The stored session slug.
    /// @return The configured chain ID.
    /// @return The public metadata URI.
    /// @return The encrypted metadata URI.
    /// @return The current session admin.
    /// @return The session creation timestamp.
    /// @return The last update timestamp.
    /// @return The session ID.
    function getSessionById(bytes16 sessionId)
        external
        view
        returns (string memory, uint256, string memory, string memory, address, uint256, uint256, bytes16)
    {
        bytes32 slugHash = sessionIdToSlugHash[sessionId];
        require(slugHash != bytes32(0), "session not found");
        Session storage s = sessions[slugHash];
        require(s.exists, "session not found");
        return
            (s.slug, s.chainId, s.metadataURI, s.encryptedMetadataURI, s.admin, s.createdAt, s.updatedAt, s.sessionId);
    }

    /// @notice Registers a new session and stores its initial metadata pointers.
    /// @dev Requires the exact `SESSION_CREATION_FEE` payment and makes the caller the session admin.
    /// @param slug The unique human-readable session slug.
    /// @param sessionId The unique session identifier.
    /// @param chainId The chain ID associated with the session.
    /// @param metadataURI The public metadata URI.
    /// @param encryptedMetadataURI The encrypted metadata URI, if any.
    function createSession(
        string calldata slug,
        bytes16 sessionId,
        uint256 chainId,
        string calldata metadataURI,
        string calldata encryptedMetadataURI
    ) external payable {
        require(msg.value == SESSION_CREATION_FEE, "incorrect creation fee");
        _createSessionInternal(slug, sessionId, chainId, metadataURI, encryptedMetadataURI);
    }

    /// @notice Withdraws all accumulated session creation fees to the contract owner.
    /// @dev Only the current owner can withdraw fees, and the call forwards the full balance.
    function withdrawFees() external {
        address currentOwner = owner();
        require(msg.sender == currentOwner, "not owner");
        uint256 amount = address(this).balance;
        (bool ok,) = currentOwner.call{value: amount}("");
        require(ok, "transfer failed");
        emit FeesWithdrawn(currentOwner, amount);
    }

    /// @notice Disables ownership renouncement for this fee-bearing registry.
    /// @dev Always reverts so an owner remains available to withdraw collected fees.
    function renounceOwnership() public pure override {
        revert("Cannot renounce ownership of fee-bearing contract");
    }

    /// @notice Updates the metadata URIs for an existing session.
    /// @dev Only the current session admin may update metadata.
    /// @param slug The slug of the session to update.
    /// @param metadataURI The replacement public metadata URI.
    /// @param encryptedMetadataURI The replacement encrypted metadata URI.
    function updateSessionMetadata(
        string calldata slug,
        string calldata metadataURI,
        string calldata encryptedMetadataURI
    ) external {
        bytes32 slugHash = _slugHash(slug);
        require(sessions[slugHash].exists, "session not found");
        require(_isAdmin(slugHash), "not admin");
        sessions[slugHash].metadataURI = metadataURI;
        sessions[slugHash].encryptedMetadataURI = encryptedMetadataURI;
        sessions[slugHash].updatedAt = block.timestamp;
        emit SessionMetadataUpdated(slugHash, metadataURI, encryptedMetadataURI);
    }

    /// @notice Updates the chain ID associated with an existing session.
    /// @dev Only the current session admin may update the chain ID.
    /// @param slug The slug of the session to update.
    /// @param chainId The replacement chain ID value.
    function updateSessionChainId(string calldata slug, uint256 chainId) external {
        bytes32 slugHash = _slugHash(slug);
        require(sessions[slugHash].exists, "session not found");
        require(_isAdmin(slugHash), "not admin");
        sessions[slugHash].chainId = chainId;
        sessions[slugHash].updatedAt = block.timestamp;
        emit SessionChainUpdated(slugHash, chainId);
    }

    /// @notice Transfers session admin rights to a new address or freezes updates with the zero address.
    /// @dev Only the current session admin may update the admin field.
    /// @param slug The slug of the session to update.
    /// @param newAdmin The replacement admin address, or zero to freeze admin-gated writes.
    function updateSessionAdmin(string calldata slug, address newAdmin) external {
        bytes32 slugHash = _slugHash(slug);
        require(sessions[slugHash].exists, "session not found");
        require(_isAdmin(slugHash), "not admin");
        // Intentionally allow zero admin to freeze future updates.
        sessions[slugHash].admin = newAdmin;
        sessions[slugHash].updatedAt = block.timestamp;
        emit SessionAdminUpdated(slugHash, newAdmin);
    }

    function _setSessionField(bytes32 slugHash, string memory fieldKey, string memory value) internal {
        require(_isAdmin(slugHash), "not admin");
        bytes32 fieldHash = _fieldHash(fieldKey);
        sessionFields[slugHash][fieldHash] = value;
        sessions[slugHash].updatedAt = block.timestamp;
        emit SessionFieldUpdated(slugHash, fieldKey, value);
    }

    function _setResourceGate(
        bytes32 slugHash,
        string calldata resourceKey,
        address[] calldata sbtAddresses,
        uint256 chainId,
        uint8 mode,
        uint256 perMemberLimit
    ) internal {
        require(mode <= uint8(GateMode.All), "invalid mode");
        require(_isAdmin(slugHash), "not admin");

        bytes32 rHash = _resourceHash(resourceKey);
        ResourceGate storage gate = resourceGates[slugHash][rHash];
        gate.sbtAddresses = sbtAddresses;
        gate.chainId = chainId;
        gate.perMemberLimit = perMemberLimit;
        gate.mode = GateMode(mode);
        sessions[slugHash].updatedAt = block.timestamp;
        emit ResourceGateUpdated(slugHash, resourceKey, chainId, GateMode(mode), perMemberLimit);
    }

    function _createSessionInternal(
        string calldata slug,
        bytes16 sessionId,
        uint256 chainId,
        string calldata metadataURI,
        string calldata encryptedMetadataURI
    ) internal returns (bytes32) {
        require(bytes(slug).length > 0, "slug required");
        require(sessionId != bytes16(0), "sessionId required");
        bytes32 slugHash = _slugHash(slug);
        require(!sessions[slugHash].exists, "session exists");
        require(sessionIdToSlugHash[sessionId] == bytes32(0), "sessionId exists");
        require(msg.sender != address(0), "invalid admin");

        Session memory s = Session({
            exists: true,
            sessionId: sessionId,
            slug: slug,
            chainId: chainId,
            metadataURI: metadataURI,
            encryptedMetadataURI: encryptedMetadataURI,
            admin: msg.sender,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        sessions[slugHash] = s;
        sessionIdToSlugHash[sessionId] = slugHash;
        sessionIndex[slugHash] = sessionSlugs.length + 1;
        sessionSlugs.push(slugHash);
        emit SessionCreated(sessionId, slugHash, slug, chainId, metadataURI, encryptedMetadataURI);
        return slugHash;
    }

    function _applyResourceGates(bytes32 slugHash, ResourceGateInput[] calldata gates) internal {
        for (uint256 i = 0; i < gates.length; i++) {
            _setResourceGate(
                slugHash,
                gates[i].resourceKey,
                gates[i].sbtAddresses,
                gates[i].chainId,
                gates[i].mode,
                gates[i].perMemberLimit
            );
        }
    }

    /// @notice Replaces the resource gate configuration for multiple resource keys on a session.
    /// @dev Only the current session admin may update gates. Existing gate entries for listed keys are overwritten.
    /// @param slug The slug of the session to update.
    /// @param gates The batch of resource gate definitions to store.
    function setResourceGates(string calldata slug, ResourceGateInput[] calldata gates) external {
        bytes32 slugHash = _slugHash(slug);
        require(sessions[slugHash].exists, "session not found");
        _applyResourceGates(slugHash, gates);
    }

    /// @notice Sets or replaces a single arbitrary session field.
    /// @dev Only the current session admin may update fields.
    /// @param slug The slug of the session to update.
    /// @param fieldKey The field name to store.
    /// @param value The string value to associate with the field.
    function setSessionField(string calldata slug, string calldata fieldKey, string calldata value) external {
        bytes32 slugHash = _slugHash(slug);
        require(sessions[slugHash].exists, "session not found");
        _setSessionField(slugHash, fieldKey, value);
    }

    /// @notice Sets or replaces multiple arbitrary session fields in one call.
    /// @dev Only the current session admin may update fields. `fieldKeys` and `values` must be the same length.
    /// @param slug The slug of the session to update.
    /// @param fieldKeys The field names to store.
    /// @param values The field values to associate with each key.
    function setSessionFields(string calldata slug, string[] calldata fieldKeys, string[] calldata values) external {
        require(fieldKeys.length == values.length, "length mismatch");
        bytes32 slugHash = _slugHash(slug);
        require(sessions[slugHash].exists, "session not found");
        for (uint256 i = 0; i < fieldKeys.length; i++) {
            _setSessionField(slugHash, fieldKeys[i], values[i]);
        }
    }

    /// @notice Returns a stored arbitrary session field value.
    /// @dev Returns an empty string when the field has not been set.
    /// @param slug The slug of the session to read.
    /// @param fieldKey The field name to look up.
    /// @return The stored field value, if any.
    function getSessionField(string calldata slug, string calldata fieldKey) external view returns (string memory) {
        bytes32 slugHash = _slugHash(slug);
        return sessionFields[slugHash][_fieldHash(fieldKey)];
    }

    /// @notice Returns multiple stored arbitrary session field values.
    /// @dev Missing fields return empty strings in their corresponding positions.
    /// @param slug The slug of the session to read.
    /// @param fieldKeys The field names to look up.
    /// @return values The stored field values in the same order as `fieldKeys`.
    function getSessionFields(string calldata slug, string[] calldata fieldKeys)
        external
        view
        returns (string[] memory values)
    {
        bytes32 slugHash = _slugHash(slug);
        values = new string[](fieldKeys.length);
        for (uint256 i = 0; i < fieldKeys.length; i++) {
            values[i] = sessionFields[slugHash][_fieldHash(fieldKeys[i])];
        }
        return values;
    }

    /// @notice Sets or replaces the gate configuration for a single resource key.
    /// @dev Only the current session admin may update gates.
    /// @param slug The slug of the session to update.
    /// @param resourceKey The resource identifier whose gate should be updated.
    /// @param sbtAddresses The allowed SBT contract addresses.
    /// @param chainId The chain ID where the SBTs are expected to exist.
    /// @param mode The gate mode enum value where `0` is Any and `1` is All.
    /// @param perMemberLimit The optional off-chain per-member limit associated with the resource.
    function setResourceGate(
        string calldata slug,
        string calldata resourceKey,
        address[] calldata sbtAddresses,
        uint256 chainId,
        uint8 mode,
        uint256 perMemberLimit
    ) external {
        bytes32 slugHash = _slugHash(slug);
        require(sessions[slugHash].exists, "session not found");
        _setResourceGate(slugHash, resourceKey, sbtAddresses, chainId, mode, perMemberLimit);
    }

    /// @notice Returns the gate configuration for a session resource.
    /// @dev Unset gates return default zero values and an empty address array.
    /// @param slug The slug of the session to read.
    /// @param resourceKey The resource identifier to look up.
    /// @return The configured SBT contract addresses.
    /// @return The configured chain ID.
    /// @return The stored gate mode enum value.
    /// @return The stored per-member limit.
    function getResourceGate(string calldata slug, string calldata resourceKey)
        external
        view
        returns (address[] memory, uint256, uint8, uint256)
    {
        bytes32 slugHash = _slugHash(slug);
        bytes32 rHash = _resourceHash(resourceKey);
        ResourceGate storage gate = resourceGates[slugHash][rHash];
        return (gate.sbtAddresses, gate.chainId, uint8(gate.mode), gate.perMemberLimit);
    }
}
