use spacetimedb::{reducer, table, DbContext, Identity, ReducerContext, Table, Timestamp};

#[table(name = "User", accessor = user, public)]
pub struct User {
    #[primary_key]
    pub identity: Identity,
    pub wallet_address: String,
    pub name: String,
    pub role: String, // "client", "freelancer", "admin"
}

#[table(name = "ChatRoom", accessor = chat_room, public)]
pub struct ChatRoom {
    #[primary_key]
    pub job_id: String,
    pub client_address: String,
    pub freelancer_address: String,
}

#[table(name = "Message", accessor = message, public)]
pub struct Message {
    #[auto_inc]
    #[primary_key]
    pub id: u64,
    pub job_id: String,
    pub sender_address: String,
    pub content: String,
    pub timestamp: Timestamp,
}

// Register a user's wallet and name with their SpacetimeDB identity
#[reducer]
pub fn register_user(ctx: &ReducerContext, wallet_address: String, name: String, role: String) {
    if ctx.db().user().identity().find(ctx.sender()).is_some() {
        // Update existing
        ctx.db().user().identity().update(User {
            identity: ctx.sender(),
            wallet_address,
            name,
            role,
        });
    } else {
        // Insert new
        ctx.db().user().insert(User {
            identity: ctx.sender(),
            wallet_address,
            name,
            role,
        });
    }
}

fn same_wallet(a: &str, b: &str) -> bool {
    a.eq_ignore_ascii_case(b)
}

// Client initiates a chat for a specific job/proposal
#[reducer]
pub fn initiate_chat(
    ctx: &ReducerContext,
    job_id: String,
    freelancer_address: String,
    client_address: String,
    initiator_role: String,
) {
    let user = ctx.db().user().identity().find(ctx.sender());
    let registered_wallet = user
        .as_ref()
        .map(|u| u.wallet_address.clone())
        .unwrap_or_default();
    let registered_role = user
        .as_ref()
        .map(|u| u.role.clone())
        .unwrap_or_default();

    // According to rules, only clients can initiate (or admins for testing)
    let room_client_address = if client_address.is_empty() {
        registered_wallet.clone()
    } else {
        client_address
    };

    if room_client_address.is_empty() {
        panic!("Client wallet address is required");
    }

    let is_registered_admin = registered_role == "admin";
    let effective_role = if initiator_role.is_empty() {
        registered_role.clone()
    } else {
        initiator_role
    };

    let can_initiate = effective_role == "client"
        || is_registered_admin
        || same_wallet(&registered_wallet, &room_client_address);

    if !can_initiate {
        panic!("Only clients can initiate chat rooms");
    }

    if ctx.db().chat_room().job_id().find(job_id.clone()).is_none() {
        ctx.db().chat_room().insert(ChatRoom {
            job_id,
            client_address: room_client_address,
            freelancer_address,
        });
    }
}

// Send a message in a chat room
#[reducer]
pub fn send_message(ctx: &ReducerContext, job_id: String, content: String, sender_address: String) {
    let user = ctx.db().user().identity().find(ctx.sender());
    
    // Verify room exists
    let room = ctx.db().chat_room().job_id().find(job_id.clone()).expect("Chat room does not exist");
    
    // Verify permissions: Must be the client, the freelancer, or an admin
    let wallet_address = if sender_address.is_empty() {
        user.as_ref()
            .map(|u| u.wallet_address.clone())
            .unwrap_or_default()
    } else {
        sender_address
    };

    if wallet_address.is_empty() {
        panic!("Sender wallet address is required");
    }

    let role = user
        .as_ref()
        .map(|u| u.role.clone())
        .unwrap_or_default();

    let is_authorized = same_wallet(&wallet_address, &room.client_address)
        || same_wallet(&wallet_address, &room.freelancer_address)
        || role == "admin";
        
    if !is_authorized {
        panic!("Not authorized to send messages in this room");
    }
    
    ctx.db().message().insert(Message {
        id: 0, // Auto-incremented
        job_id,
        sender_address: wallet_address,
        content,
        timestamp: ctx.timestamp,
    });
}
