use spacetimedb::{spacetimedb, Identity, ReducerContext, Timestamp};

#[spacetimedb(table)]
pub struct User {
    #[primarykey]
    pub identity: Identity,
    pub wallet_address: String,
    pub name: String,
    pub role: String, // "client", "freelancer", "admin"
}

#[spacetimedb(table)]
pub struct ChatRoom {
    #[primarykey]
    pub job_id: String,
    pub client_address: String,
    pub freelancer_address: String,
}

#[spacetimedb(table)]
pub struct Message {
    #[autoinc]
    pub id: u64,
    pub job_id: String,
    pub sender_address: String,
    pub content: String,
    pub timestamp: Timestamp,
}

// Register a user's wallet and name with their SpacetimeDB identity
#[spacetimedb(reducer)]
pub fn register_user(ctx: ReducerContext, wallet_address: String, name: String, role: String) {
    if User::filter_by_identity(&ctx.sender).is_some() {
        // Update existing
        User::update_by_identity(
            &ctx.sender,
            User {
                identity: ctx.sender,
                wallet_address,
                name,
                role,
            },
        );
    } else {
        // Insert new
        User::insert(User {
            identity: ctx.sender,
            wallet_address,
            name,
            role,
        });
    }
}

// Client initiates a chat for a specific job/proposal
#[spacetimedb(reducer)]
pub fn initiate_chat(ctx: ReducerContext, job_id: String, freelancer_address: String) {
    let user = User::filter_by_identity(&ctx.sender).expect("User not registered");
    
    // According to rules, only clients can initiate (or admins for testing)
    // We assume the frontend ensures the caller is the actual client for this job.
    // In a fully decentralized setup, we'd verify a signature or on-chain state,
    // but for this DB module, we trust the caller's registered wallet_address.
    
    if ChatRoom::filter_by_job_id(&job_id).is_none() {
        ChatRoom::insert(ChatRoom {
            job_id,
            client_address: user.wallet_address,
            freelancer_address,
        });
    }
}

// Send a message in a chat room
#[spacetimedb(reducer)]
pub fn send_message(ctx: ReducerContext, job_id: String, content: String) {
    let user = User::filter_by_identity(&ctx.sender).expect("User not registered");
    
    // Verify room exists
    let room = ChatRoom::filter_by_job_id(&job_id).expect("Chat room does not exist");
    
    // Verify permissions: Must be the client, the freelancer, or an admin
    let is_authorized = user.wallet_address == room.client_address 
        || user.wallet_address == room.freelancer_address 
        || user.role == "admin";
        
    if !is_authorized {
        panic!("Not authorized to send messages in this room");
    }
    
    Message::insert(Message {
        id: 0, // Auto-incremented
        job_id,
        sender_address: user.wallet_address,
        content,
        timestamp: ctx.timestamp,
    });
}
