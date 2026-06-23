use spacetimedb::{reducer, table, DbContext, Identity, ReducerContext, Table, Timestamp};

#[table(name = "User", accessor = user, public)]
pub struct User {
    #[primary_key]
    pub identity: Identity,
    pub wallet_address: String,
    pub name: String,
    pub role: String, // "client", "freelancer", "founder", "investor", "admin"
}

#[table(name = "ChatRoom", accessor = chat_room, public)]
pub struct ChatRoom {
    #[primary_key]
    pub job_id: String,
    pub client_address: String,
    pub freelancer_address: String,
}

#[table(name = "ChatMember", accessor = chat_member, public)]
pub struct ChatMember {
    #[primary_key]
    pub member_key: String,
    pub job_id: String,
    pub wallet_address: String,
    pub member_role: String, // "founder", "investor"
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

#[table(name = "ClientNotificationEvent", accessor = client_notification_event, public)]
pub struct ClientNotificationEvent {
    #[auto_inc]
    #[primary_key]
    pub id: u64,
    pub client_address: String,
    pub event_type: String,
    pub entity_type: String,
    pub entity_id: String,
    pub actor_address: String,
    pub title: String,
    pub message: String,
    pub route: String,
    pub timestamp: Timestamp,
}

fn same_wallet(a: &str, b: &str) -> bool {
    a.eq_ignore_ascii_case(b)
}

fn is_company_chat(job_id: &str) -> bool {
    job_id.starts_with("company-")
}

fn is_company_room(job_id: &str, freelancer_address: &str) -> bool {
    if !is_company_chat(job_id) {
        return false;
    }

    let company_id = job_id.trim_start_matches("company-");
    freelancer_address == format!("company-group-{}", company_id)
}

fn member_key_for(job_id: &str, wallet_address: &str) -> String {
    format!("{}:{}", job_id, wallet_address.to_ascii_lowercase())
}

fn upsert_chat_member(
    ctx: &ReducerContext,
    job_id: String,
    wallet_address: String,
    member_role: String,
) {
    let key = member_key_for(&job_id, &wallet_address);
    if ctx.db().chat_member().member_key().find(key.clone()).is_some() {
        return;
    }

    ctx.db().chat_member().insert(ChatMember {
        member_key: key,
        job_id,
        wallet_address,
        member_role,
    });
}

fn is_chat_member(ctx: &ReducerContext, job_id: &str, wallet_address: &str) -> bool {
    let key = member_key_for(job_id, wallet_address);
    ctx.db().chat_member().member_key().find(key).is_some()
}

// Register a user's wallet and name with their SpacetimeDB identity
#[reducer]
pub fn register_user(ctx: &ReducerContext, wallet_address: String, name: String, role: String) {
    if ctx.db().user().identity().find(ctx.sender()).is_some() {
        ctx.db().user().identity().update(User {
            identity: ctx.sender(),
            wallet_address,
            name,
            role,
        });
    } else {
        ctx.db().user().insert(User {
            identity: ctx.sender(),
            wallet_address,
            name,
            role,
        });
    }
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
        || same_wallet(&registered_wallet, &room_client_address)
        || (
            is_company_room(&job_id, &freelancer_address)
                && (effective_role == "founder" || effective_role == "investor")
        );

    if !can_initiate {
        panic!("Only clients can initiate chat rooms");
    }

    if ctx.db().chat_room().job_id().find(job_id.clone()).is_none() {
        ctx.db().chat_room().insert(ChatRoom {
            job_id: job_id.clone(),
            client_address: room_client_address.clone(),
            freelancer_address,
        });

        if is_company_chat(&job_id) {
            upsert_chat_member(
                ctx,
                job_id,
                room_client_address,
                "founder".to_string(),
            );
        }
    }
}

// Join or ensure membership in a company group chat room
#[reducer]
pub fn ensure_chat_member(
    ctx: &ReducerContext,
    job_id: String,
    wallet_address: String,
    member_role: String,
) {
    if !is_company_chat(&job_id) {
        panic!("Members can only be added to company chat rooms");
    }

    ctx.db()
        .chat_room()
        .job_id()
        .find(job_id.clone())
        .expect("Chat room does not exist");

    let user = ctx.db().user().identity().find(ctx.sender());
    let registered_wallet = user
        .as_ref()
        .map(|u| u.wallet_address.clone())
        .unwrap_or_default();
    let registered_role = user
        .as_ref()
        .map(|u| u.role.clone())
        .unwrap_or_default();

    let wallet = if wallet_address.is_empty() {
        registered_wallet.clone()
    } else {
        wallet_address
    };

    if wallet.is_empty() {
        panic!("Wallet address is required");
    }

    if registered_role != "admin" && !same_wallet(&wallet, &registered_wallet) {
        panic!("Can only join company chat as yourself");
    }

    let role = if member_role.is_empty() {
        if registered_role == "founder" {
            "founder".to_string()
        } else {
            "investor".to_string()
        }
    } else {
        member_role
    };

    upsert_chat_member(ctx, job_id, wallet, role);
}

// Send a message in a chat room
#[reducer]
pub fn send_message(ctx: &ReducerContext, job_id: String, content: String, sender_address: String) {
    let user = ctx.db().user().identity().find(ctx.sender());

    let room = ctx
        .db()
        .chat_room()
        .job_id()
        .find(job_id.clone())
        .expect("Chat room does not exist");

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

    let is_member = is_company_chat(&job_id) && is_chat_member(ctx, &job_id, &wallet_address);

    let is_authorized = is_member
        || same_wallet(&wallet_address, &room.client_address)
        || same_wallet(&wallet_address, &room.freelancer_address)
        || role == "admin"
        || (
            is_company_room(&room.job_id, &room.freelancer_address)
                && (role == "founder" || role == "investor")
        );

    if !is_authorized {
        panic!("Not authorized to send messages in this room");
    }

    ctx.db().message().insert(Message {
        id: 0,
        job_id,
        sender_address: wallet_address,
        content,
        timestamp: ctx.timestamp,
    });
}

#[reducer]
pub fn trigger_client_notification(
    ctx: &ReducerContext,
    client_address: String,
    event_type: String,
    entity_type: String,
    entity_id: String,
    actor_address: String,
    title: String,
    message: String,
    route: String,
) {
    if client_address.is_empty() {
        panic!("Client wallet address is required");
    }

    ctx.db().client_notification_event().insert(ClientNotificationEvent {
        id: 0,
        client_address,
        event_type,
        entity_type,
        entity_id,
        actor_address,
        title,
        message,
        route,
        timestamp: ctx.timestamp,
    });
}
