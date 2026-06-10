db = db.getSiblingDB("tp_jwt_mongodb");

db.users.drop();
db.posts.drop();
db.flags.drop();

db.users.insertMany([
  {
    _id: ObjectId("665000000000000000000001"),
    username: "admin",
    email: "admin@tp.local",
    password: "admin123",
    role: "admin",
    avatar: "/uploads/admin.svg",
    bio: "Administrateur de la plateforme.",
    isActive: true
  },
  {
    _id: ObjectId("665000000000000000000002"),
    username: "alice",
    email: "alice@tp.local",
    password: "alice123",
    role: "user",
    avatar: "/uploads/alice.svg",
    bio: "Étudiante en cybersécurité.",
    isActive: true
  },
  {
    _id: ObjectId("665000000000000000000003"),
    username: "bob",
    email: "bob@tp.local",
    password: "bob123",
    role: "user",
    avatar: "/uploads/bob.svg",
    bio: "Développeur junior.",
    isActive: true
  },
  {
    _id: ObjectId("665000000000000000000004"),
    username: "charlie",
    email: "charlie@tp.local",
    password: "charlie123",
    role: "user",
    avatar: "/uploads/charlie.svg",
    bio: "Compte désactivé mais encore présent en base.",
    isActive: false
  }
]);

db.posts.insertMany([
  {
    title: "Bienvenue sur le réseau interne",
    content: "Chaque utilisateur peut publier un message visible par les autres.",
    authorId: ObjectId("665000000000000000000001"),
    authorUsername: "admin",
    visibility: "public",
    createdAt: new Date()
  },
  {
    title: "Premier post",
    content: "Je teste la plateforme avec mon compte utilisateur.",
    authorId: ObjectId("665000000000000000000002"),
    authorUsername: "alice",
    visibility: "public",
    createdAt: new Date()
  },
  {
    title: "Question sécurité",
    content: "Est-ce que le token JWT contient des informations sensibles ?",
    authorId: ObjectId("665000000000000000000003"),
    authorUsername: "bob",
    visibility: "public",
    createdAt: new Date()
  },
  {
    title: "Message privé admin",
    content: "FLAG_ADMIN_PANEL{jwt_role_escalation_possible}",
    authorId: ObjectId("665000000000000000000001"),
    authorUsername: "admin",
    visibility: "admin",
    createdAt: new Date()
  }
]);

db.flags.insertMany([
  { name: "nosql_login_bypass", value: "FLAG_NOSQL{login_bypass_with_mongodb_operator}", hint: "Regarder comment le formulaire de login interroge MongoDB." },
  { name: "jwt_weak_secret", value: "FLAG_JWT{weak_secret_can_be_bruteforced}", hint: "Le secret JWT est faible et présent dans docker-compose.yml." },
  { name: "jwt_role_escalation", value: "FLAG_JWT{role_user_to_admin}", hint: "Le rôle utilisateur est-il vérifié côté serveur ou seulement dans le token ?" },
  { name: "mongodb_objectid_enum", value: "FLAG_MONGO{objectid_profile_enumeration}", hint: "Les profils utilisateurs sont accessibles par ObjectId." }
]);
