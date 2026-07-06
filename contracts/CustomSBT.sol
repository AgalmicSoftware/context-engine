// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

error NoGroupPassword();
error InvalidNonce(uint256 expected, uint256 got);
error InvalidSignature();
error MaxTokensReached();
error AlreadyOwns();
error InvalidTokenId();

/// @title Context Engine CustomSBT
/// @notice Soulbound ERC-721 collection used for session/group membership.
/// @dev This contract advertises ERC-165 support for ERC-5192 (`locked`) and
/// ERC-5484 (`burnAuth(uint256)` + `Issued`) while also exposing the
/// app-specific `SBTActivity`, `collectionBurnAuth()`, and `getHistorySummary()`
/// helpers used by Context Engine history reads.
contract MySBT is ERC721, ERC721Burnable, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    error Soulbound();

    bytes4 private constant _INTERFACE_ID_ERC5192 = 0xb45a3c0e;
    bytes4 private constant _INTERFACE_ID_ERC5484 = 0x0489b56f;

    uint256 public immutable maxTokens;
    uint256 public mintedTokens;
    address public immutable admin;
    address public immutable deployingFactory;
    uint256 public immutable mintingEndTime;
    bool public immutable hasPasswordMint;
    MintMode public immutable mintMode;
    bool public tokenURIInitAllowed;
    bool public groupPasswordHashInitAllowed;
    mapping(bytes32 => bool) private _validHashedPasswords;
    mapping(address => uint256) private _claimStartTime;
    string private _tokenURI;

    // User commitments: keccak256(abi.encodePacked(password, user))
    mapping(address => bytes32) private _commitments;

    // Owner -> tokenId
    mapping(address => uint256) private _userTokens;
    mapping(address => bool) private _hasHeldToken;

    // for group-password signature flow (unlimited)
    bytes32 public groupPasswordHash;
    uint256 private _burnedTokensCount;
    uint256 private _currentHolderCount;
    uint256 private _historicalHolderCount;

    event TokenURIInitialized(string tokenURI);
    event GroupPasswordHashInitialized(bytes32 groupPasswordHash);
    event Locked(uint256 tokenId);
    event Issued(address indexed from, address indexed to, uint256 indexed tokenId, uint8 burnAuth);
    event SBTActivity(address indexed account, uint256 indexed tokenId, bool indexed burned);

    enum BurnAuth {
        IssuerOnly,
        OwnerOnly,
        Both,
        Neither
    }

    enum MintMode {
        PublicClaim,
        PasswordCommitReveal,
        UnlimitedGroupSignature,
        LimitedInviteSignature
    }

    BurnAuth private immutable _collectionBurnAuth;

    modifier onlyAdmin() {
        require(admin == msg.sender, "Not admin");
        _;
    }

    modifier mintingActive() {
        require(mintingEndTime == 0 || block.timestamp < mintingEndTime, "Minting ended");
        _;
    }

    modifier onlyDeployingFactory() {
        require(msg.sender == deployingFactory, "Only factory");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 _limitedNumber,
        address _adminAddress,
        uint256 _mintingEndTime,
        MintMode _mintMode,
        BurnAuth _burnAuth,
        bytes32[] memory hashedPasswords,
        string memory tokenURI_,
        bytes32 _groupPasswordHash,
        bool _allowTokenURIInit,
        bool _allowGroupPasswordHashInit
    ) ERC721(name, symbol) Ownable(_adminAddress != address(0) ? _adminAddress : msg.sender) {
        _validateMintModeConfig(
            _mintMode, _limitedNumber, hashedPasswords, _groupPasswordHash, _allowGroupPasswordHashInit
        );
        maxTokens = _limitedNumber;
        admin = _adminAddress != address(0) ? _adminAddress : msg.sender;
        deployingFactory = msg.sender;
        mintingEndTime = _mintingEndTime;
        mintMode = _mintMode;
        hasPasswordMint =
            _mintMode == MintMode.PasswordCommitReveal || _mintMode == MintMode.LimitedInviteSignature;
        _collectionBurnAuth = _burnAuth;
        _tokenURI = tokenURI_;
        groupPasswordHash = _groupPasswordHash;
        tokenURIInitAllowed = _allowTokenURIInit;
        groupPasswordHashInitAllowed = _allowGroupPasswordHashInit;

        _addHashedPasswords(hashedPasswords);
    }

    function _validateMintModeConfig(
        MintMode _mintMode,
        uint256 _limitedNumber,
        bytes32[] memory hashedPasswords,
        bytes32 _groupPasswordHash,
        bool _allowGroupPasswordHashInit
    ) internal pure {
        bool hasHashedPasswords = hashedPasswords.length > 0;
        bool hasGroupSignerHash = _groupPasswordHash != bytes32(0);

        if (_allowGroupPasswordHashInit) {
            require(!hasGroupSignerHash, "Deferred group signer hash must start empty");
        }

        if (_mintMode == MintMode.PublicClaim) {
            require(!hasHashedPasswords, "Public claim cannot preload passwords");
            require(!hasGroupSignerHash, "Public claim cannot preload signer hash");
            require(!_allowGroupPasswordHashInit, "Public claim cannot defer signer hash");
            return;
        }

        if (_mintMode == MintMode.PasswordCommitReveal) {
            require(hasHashedPasswords, "Password mint requires hashes");
            require(!hasGroupSignerHash, "Password mint cannot preload signer hash");
            require(!_allowGroupPasswordHashInit, "Password mint cannot defer signer hash");
            return;
        }

        if (_mintMode == MintMode.UnlimitedGroupSignature) {
            require(!hasHashedPasswords, "Group signature mint cannot preload passwords");
            require(hasGroupSignerHash || _allowGroupPasswordHashInit, "Group signature mint requires signer hash");
            return;
        }

        require(_limitedNumber > 0, "Invite mint requires positive max tokens");
        require(!hasHashedPasswords, "Invite mint cannot preload passwords");
        require(hasGroupSignerHash || _allowGroupPasswordHashInit, "Invite mint requires signer hash");
    }

    /// @notice Sets the collection-wide token URI after deployment when deferred initialization is enabled.
    /// @dev Callable only by the deploying factory and only once.
    /// @param tokenURI_ The metadata URI to assign to all minted tokens.
    function initializeTokenURI(string memory tokenURI_) external onlyDeployingFactory {
        require(tokenURIInitAllowed, "Token URI init not allowed");
        require(bytes(_tokenURI).length == 0, "Token URI already set");
        require(bytes(tokenURI_).length > 0, "Token URI required");
        _tokenURI = tokenURI_;
        tokenURIInitAllowed = false;
        emit TokenURIInitialized(tokenURI_);
    }

    /// @notice Sets the invite signer hash after deployment when deferred initialization is enabled.
    /// @dev Callable only by the deploying factory and only once.
    /// @param _groupPasswordHash The keccak256 hash of the authorized invite signer address.
    function initializeGroupPasswordHash(bytes32 _groupPasswordHash) external onlyDeployingFactory {
        require(groupPasswordHashInitAllowed, "Group password init not allowed");
        require(groupPasswordHash == bytes32(0), "Group password already set");
        require(_groupPasswordHash != bytes32(0), "Group password hash required");
        groupPasswordHash = _groupPasswordHash;
        groupPasswordHashInitAllowed = false;
        emit GroupPasswordHashInitialized(_groupPasswordHash);
    }

    /// @notice Adds claim passwords that can each be consumed once.
    /// @dev Only the SBT admin can add passwords, and additions stop once the max supply is reached.
    /// @param hashedPasswords The keccak256 hashes of plain-text claim passwords.
    function addHashedPasswords(bytes32[] memory hashedPasswords) public onlyAdmin {
        _addHashedPasswords(hashedPasswords);
    }

    function _addHashedPasswords(bytes32[] memory hashedPasswords) internal {
        for (uint256 i = 0; i < hashedPasswords.length; i++) {
            require(maxTokens == 0 || mintedTokens < maxTokens, "Max tokens reached");
            _validHashedPasswords[hashedPasswords[i]] = true;
        }
    }

    /// @notice Starts a password claim by storing the caller commitment and start timestamp.
    /// @dev The commitment must be `keccak256(abi.encodePacked(password, msg.sender))`.
    /// @param userCommit The caller-specific password commitment used during `claimWithPassword`.
    function startClaim(bytes32 userCommit) public {
        require(mintMode == MintMode.PasswordCommitReveal, "Password mint not enabled");
        _commitments[msg.sender] = userCommit;
        _claimStartTime[msg.sender] = block.timestamp;
    }

    /// @notice Claims an SBT by revealing a valid password after the anti-front-running delay.
    /// @dev Reuses the commitment stored by `startClaim` and consumes the password on success.
    /// @param password The plain-text password that hashes to an available claim slot.
    function claimWithPassword(string memory password) public nonReentrant {
        require(mintMode == MintMode.PasswordCommitReveal, "Password mint not enabled");
        require(_claimStartTime[msg.sender] != 0, "Claim not started");
        // 5-second wait from startClaim (front-run protection)
        require(block.timestamp >= _claimStartTime[msg.sender] + 5, "Wait 5 seconds");

        // Check commitment keccak256(password, msg.sender)
        require(_commitments[msg.sender] == keccak256(abi.encodePacked(password, msg.sender)), "Commitment mismatch");

        // Check password availability
        bytes32 hashedPassword = keccak256(abi.encodePacked(password));
        require(_validHashedPasswords[hashedPassword], "Invalid password");
        _validHashedPasswords[hashedPassword] = false; // consume

        // Clear commitment to prevent reuse
        _commitments[msg.sender] = 0;

        _mintSoulbound(msg.sender);
    }

    /// @notice Mints an SBT using a reusable group signature tied to the caller address.
    /// @dev The signature must be an EIP-191 signature over `keccak256(abi.encodePacked(address(this), msg.sender))`.
    /// @param signature The signed authorization proving the invite signer approved the caller.
    function mintWithGroupSignature(bytes calldata signature) external mintingActive nonReentrant {
        require(mintMode == MintMode.UnlimitedGroupSignature, "Group signature mint not enabled");
        require(groupPasswordHash != bytes32(0), "No group password set");
        require(maxTokens == 0 || mintedTokens < maxTokens, "Max tokens reached");
        require(_userTokens[msg.sender] == 0, "Address already owns an SBT");

        bytes32 message = keccak256(abi.encodePacked(address(this), msg.sender));
        address signer = ECDSA.recover(message.toEthSignedMessageHash(), signature);
        require(keccak256(abi.encodePacked(signer)) == groupPasswordHash, "Invalid signature");

        _mintSoulbound(msg.sender);
    }

    /// @notice Mints an SBT using a one-time invite signature tied to the next sequential nonce.
    /// @dev Reverts with `NoGroupPassword` when invite signing is disabled, `InvalidNonce` when `nonce`
    /// does not equal `mintedTokens + 1`, `InvalidSignature` when recovery fails or the recovered signer
    /// hash does not match `groupPasswordHash`, `MaxTokensReached` when the collection is full, and
    /// `AlreadyOwns` when the caller already owns an SBT.
    /// @param nonce The expected invite nonce for this mint, which must equal `mintedTokens + 1`.
    /// @param signature The EIP-191 signature over `keccak256(abi.encodePacked(address(this), nonce))`.
    function claimWithInvite(uint256 nonce, bytes calldata signature) external mintingActive nonReentrant {
        require(mintMode == MintMode.LimitedInviteSignature, "Invite mint not enabled");
        if (groupPasswordHash == bytes32(0)) {
            revert NoGroupPassword();
        }

        if (nonce != mintedTokens + 1) {
            revert InvalidNonce(mintedTokens + 1, nonce);
        }

        bytes32 message = keccak256(abi.encodePacked(address(this), nonce));
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(message.toEthSignedMessageHash(), signature);
        if (err != ECDSA.RecoverError.NoError) {
            revert InvalidSignature();
        }

        if (keccak256(abi.encodePacked(signer)) != groupPasswordHash) {
            revert InvalidSignature();
        }

        if (maxTokens != 0 && mintedTokens >= maxTokens) {
            revert MaxTokensReached();
        }
        if (balanceOf(msg.sender) > 0) {
            revert AlreadyOwns();
        }

        _mintSoulbound(msg.sender);
    }

    /// @notice Mints an SBT through the public claim path when password minting is disabled.
    /// @dev This path is available only for collections configured without password-based minting.
    function claim() public nonReentrant {
        require(mintMode == MintMode.PublicClaim, "Public claim not enabled");
        _mintSoulbound(msg.sender);
    }

    /// @notice Returns the collection-wide ERC-5484 burn authorization policy.
    /// @dev This stays readable before any token exists, unlike `burnAuth(tokenId)`.
    /// @return The immutable burn policy configured at deployment.
    function collectionBurnAuth() public view returns (uint8) {
        return uint8(_collectionBurnAuth);
    }

    /// @notice Returns the burn authorization for a minted token per ERC-5484.
    /// @dev The policy is collection-wide in this implementation.
    /// @param tokenId The token identifier being queried.
    /// @return The immutable burn policy configured for the collection.
    function burnAuth(uint256 tokenId) public view returns (uint8) {
        if (_ownerOf(tokenId) == address(0)) {
            revert InvalidTokenId();
        }
        return uint8(_collectionBurnAuth);
    }

    /// @notice Returns whether a token is permanently locked per ERC-5192.
    /// @dev All live tokens are always locked because transfers are disabled.
    /// @param tokenId The token identifier being queried.
    /// @return Always true for minted tokens.
    function locked(uint256 tokenId) public view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) {
            revert InvalidTokenId();
        }
        return true;
    }

    /// @notice Returns a compressed on-chain history summary for count-only reads.
    /// @dev This summary is intentionally storage-light and does not replace
    /// event scans when a full holder list is required.
    /// @return totalMinted The historical number of successful mints.
    /// @return totalBurned The historical number of successful burns.
    /// @return activeSupply The number of currently live tokens.
    /// @return currentHolderCount The number of current holders.
    /// @return historicalHolderCount The number of unique holders who have ever minted.
    function getHistorySummary()
        public
        view
        returns (
            uint256 totalMinted,
            uint256 totalBurned,
            uint256 activeSupply,
            uint256 currentHolderCount,
            uint256 historicalHolderCount
        )
    {
        totalMinted = mintedTokens;
        totalBurned = _burnedTokensCount;
        activeSupply = mintedTokens - _burnedTokensCount;
        currentHolderCount = _currentHolderCount;
        historicalHolderCount = _historicalHolderCount;
    }

    /// @notice Mints a new locked soulbound token and emits all standard/app history events.
    /// @param to The address receiving the token.
    function _mintSoulbound(address to) internal mintingActive {
        require(maxTokens == 0 || mintedTokens < maxTokens, "Max tokens reached");
        require(_userTokens[to] == 0, "Address already owns an SBT");
        mintedTokens++;
        uint256 tokenId = mintedTokens;
        _userTokens[to] = tokenId;
        _safeMint(to, tokenId);
        if (!_hasHeldToken[to]) {
            _hasHeldToken[to] = true;
            _historicalHolderCount++;
        }
        _currentHolderCount++;
        emit Issued(admin, to, tokenId, uint8(_collectionBurnAuth));
        emit Locked(tokenId);
        emit SBTActivity(to, tokenId, false);
    }

    /// @notice Burns a token when the configured burn authorization permits the caller.
    /// @dev The token owner, the issuer admin, or both may be allowed depending on `burnAuth`.
    /// @param tokenId The token identifier to burn.
    // `_safeMint` reaches external receiver hooks, so burns must share the
    // same reentrancy guard or a receiver can burn during mint finalization
    // and corrupt the summary counters / event ordering.
    function burn(uint256 tokenId) public override nonReentrant {
        address owner = ownerOf(tokenId);
        require(
            (_collectionBurnAuth == BurnAuth.OwnerOnly && owner == msg.sender)
                || (_collectionBurnAuth == BurnAuth.Both && (owner == msg.sender || admin == msg.sender))
                || (_collectionBurnAuth == BurnAuth.IssuerOnly && admin == msg.sender),
            "Not authorized to burn"
        );
        super.burn(tokenId);
        _userTokens[owner] = 0;
        _burnedTokensCount++;
        if (_currentHolderCount > 0) {
            _currentHolderCount--;
        }
        emit SBTActivity(owner, tokenId, true);
    }

    /// @notice Disabled for soulbound tokens.
    /// @dev Always reverts with `Soulbound`.
    /// @param operator The operator address, unused because approvals are disabled.
    /// @param tokenId The token identifier, unused because approvals are disabled.
    function approve(address operator, uint256 tokenId) public virtual override {
        operator;
        tokenId;
        revert Soulbound();
    }

    /// @notice Disabled for soulbound tokens.
    /// @dev Always reverts with `Soulbound`.
    /// @param operator The operator address, unused because approvals are disabled.
    /// @param approved The approval flag, unused because approvals are disabled.
    function setApprovalForAll(address operator, bool approved) public virtual override {
        operator;
        approved;
        revert Soulbound();
    }

    /// @notice Disabled for soulbound tokens.
    /// @dev Always reverts with `Soulbound`.
    /// @param from The current owner address, unused because transfers are disabled.
    /// @param to The recipient address, unused because transfers are disabled.
    /// @param tokenId The token identifier, unused because transfers are disabled.
    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        from;
        to;
        tokenId;
        revert Soulbound();
    }

    /// @notice Disabled for soulbound tokens.
    /// @dev Always reverts with `Soulbound`.
    /// @param from The current owner address, unused because transfers are disabled.
    /// @param to The recipient address, unused because transfers are disabled.
    /// @param tokenId The token identifier, unused because transfers are disabled.
    /// @param data The transfer data, unused because transfers are disabled.
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual override {
        from;
        to;
        tokenId;
        data;
        revert Soulbound();
    }

    function _isAuthorized(address owner, address spender, uint256 tokenId)
        internal
        view
        virtual
        override
        returns (bool)
    {
        if ((_collectionBurnAuth == BurnAuth.IssuerOnly || _collectionBurnAuth == BurnAuth.Both) && spender == admin) {
            return true;
        }
        return spender != address(0)
            && (owner == spender || isApprovedForAll(owner, spender) || _getApproved(tokenId) == spender);
    }

    /// @notice Advertises ERC-721, ERC-5192, and ERC-5484 interface support.
    /// @param interfaceId The queried ERC-165 interface id.
    /// @return True when the interface is supported by this contract.
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == _INTERFACE_ID_ERC5192
            || interfaceId == _INTERFACE_ID_ERC5484
            || super.supportsInterface(interfaceId);
    }

    /// @notice Returns the shared metadata URI used for all tokens in the collection.
    /// @dev Reverts for nonexistent or burned tokens, matching ERC-721 metadata expectations.
    /// @param tokenId The token identifier whose metadata URI is being queried.
    /// @return The collection-wide metadata URI.
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) {
            revert InvalidTokenId();
        }
        return _tokenURI;
    }

    /// @notice Returns the core collection configuration and mint state for this SBT contract.
    /// @dev This is a convenience getter that aggregates several storage fields into one call.
    /// @return name_ The ERC721 collection name.
    /// @return symbol_ The ERC721 collection symbol.
    /// @return maxTokens_ The maximum mintable supply, or zero when uncapped.
    /// @return mintedTokens_ The number of tokens minted so far.
    /// @return admin_ The immutable collection admin.
    /// @return mintingEndTime_ The mint cutoff timestamp, or zero when minting does not expire.
    /// @return hasPasswordMint_ Whether password-based minting is enabled.
    /// @return burnAuth_ The configured burn authorization mode.
    /// @return tokenURI_ The collection-wide metadata URI.
    function getSBTMetadata()
        public
        view
        returns (
            string memory name_,
            string memory symbol_,
            uint256 maxTokens_,
            uint256 mintedTokens_,
            address admin_,
            uint256 mintingEndTime_,
            bool hasPasswordMint_,
            BurnAuth burnAuth_,
            string memory tokenURI_
        )
    {
        name_ = name();
        symbol_ = symbol();
        maxTokens_ = maxTokens;
        mintedTokens_ = mintedTokens;
        admin_ = admin;
        mintingEndTime_ = mintingEndTime;
        hasPasswordMint_ = hasPasswordMint;
        burnAuth_ = _collectionBurnAuth;
        tokenURI_ = _tokenURI;

        return
            (name_, symbol_, maxTokens_, mintedTokens_, admin_, mintingEndTime_, hasPasswordMint_, burnAuth_, tokenURI_);
    }

    /// @notice Returns the token ID owned by an address, if any.
    /// @dev Returns zero when the address does not currently hold an SBT from this collection.
    /// @param owner The address to query.
    /// @return The owned token ID, or zero when the address has not minted.
    function getTokenIdByOwner(address owner) public view returns (uint256) {
        return _userTokens[owner];
    }

    /// @notice Checks whether a hashed password is currently available for claiming.
    /// @dev Password hashes are consumed once `claimWithPassword` succeeds.
    /// @param hashedPassword The keccak256 hash of the plain-text claim password.
    /// @return True when the password hash can still be used to claim.
    function isPasswordValid(bytes32 hashedPassword) public view returns (bool) {
        return _validHashedPasswords[hashedPassword];
    }
}
