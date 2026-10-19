import {FastifyReply, FastifyRequest} from "fastify";
import FamilyService from "./family.service.js";

export async function get_user_families(req: FastifyRequest, reply: FastifyReply) {
    const user = req.user;
    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const families = await FamilyService.getFamiliesByUserId(user.uuid);

    return families.map(family => {
        return {
            uuid: family.uuid,
            name: family.name
        }
    });
}

export async function get_family(req: FastifyRequest<{
    Params: {
        familyId: string
    }
}>, reply: FastifyReply) {
    const familyUuid: string = req.params.familyId;

    const user = req.user;
    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    const family = await FamilyService.getFamilyById(familyUuid);

    if(!family){
        reply.status(404).send({error: 'Family not found'});
        return;
    }

    if(!family.isMember(user.uuid)){
        reply.status(403).send({error: 'Forbidden'});
        return;
    }

    reply.status(200).send({
        uuid: family.uuid,
        name: family.name,
        members: family.members.map((member) => {
            return {
                uuid: member.uuid,
                userUuid: member.user.uuid,
                name: member.name,
                virtual: member.user.virtual,
                // Une valeur absente/nulle (lignes d'avant la colonne) = activé.
                priorityEnabled: member.priorityEnabled !== false,
                image: member.image ?? null
            }
        })
    })
}

export async function create_family(req: FastifyRequest<{
    Body: {
        familyName: string,
        username: string
    }
}>, reply: FastifyReply) {
    const {familyName, username} = req.body;
    const user = req.user;
    if (!user) {
        return reply.status(401).send({error: "Unauthorized"});
    }

    if((await FamilyService.getFamilyByName(familyName)) !== null) {
        return reply.status(400).send({error: "Family already exists"});
    }

    const family = await FamilyService.createFamily(familyName, user.uuid, username);

    if (!family) {
        return reply.status(500).send({error: "Failed to create family"});
    }

    return reply.status(200).send({
        uuid: family.uuid,
        name: family.name
    })
}

export async function rename_member(req: FastifyRequest<{
    Params: {
        memberUuid: string
    },
    Body: {
        name: string
    }
}>, reply: FastifyReply) {
    const {memberUuid} = req.params;
    const {name} = req.body;
    const user = req.user;
    if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
    }

    // Fastify peut coercer les scalaires : on vérifie explicitement le type avant
    // de manipuler la chaîne (et on refuse un nom vide ou uniquement composé d'espaces).
    if (typeof name !== 'string' || name.trim().length === 0) {
        return reply.status(400).send({ error: 'Bad parameter: name must be a non-empty string' });
    }

    const trimmedName = name.trim();

    const member = await FamilyService.getMemberOfFamilyByUuid(memberUuid);
    if (!member) {
        return reply.status(404).send({ error: 'Member not found' });
    }

    // L'appelant doit appartenir à la famille du membre.
    if (!member.family.isMember(user.uuid)) {
        return reply.status(403).send({ error: 'Forbidden' });
    }

    // Chacun peut se renommer lui-même ; tout membre de la famille peut renommer
    // un membre dont la liste est gérée par la famille, peu importe qui l'a créé.
    // Les autres membres sont protégés.
    const isSelf = member.user.uuid === user.uuid;
    const isVirtual = member.user.virtual === true;
    if (!isSelf && !isVirtual) {
        return reply.status(403).send({ error: 'Forbidden, you can only rename yourself or a member whose list is managed by the family' });
    }

    const updated = await FamilyService.renameFamilyMember(member, trimmedName);

    return reply.status(200).send({
        uuid: updated.uuid,
        userUuid: updated.user.uuid,
        name: updated.name,
        virtual: updated.user.virtual === true
    });
}

/**
 * Active ou désactive l'ordonnancement par priorité de sa propre liste.
 * Visible uniquement sur SA liste (le frontend n'affiche pas le switch sur les
 * listes gérées par la famille), et le serveur exige que l'appelant soit le propriétaire.
 * Le réglage s'applique à tous les visiteurs de la liste.
 */
export async function set_member_priority(req: FastifyRequest<{
    Params: {
        memberUuid: string
    },
    Body: {
        enabled: boolean
    }
}>, reply: FastifyReply) {
    const {memberUuid} = req.params;
    const enabled = req.body?.enabled;
    const user = req.user;

    if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
    }

    // Fastify peut coercer les scalaires : on vérifie explicitement le type.
    if (typeof enabled !== 'boolean') {
        return reply.status(400).send({ error: 'Bad parameter: enabled must be a boolean' });
    }

    const member = await FamilyService.getMemberOfFamilyByUuid(memberUuid);
    if (!member) {
        return reply.status(404).send({ error: 'Member not found' });
    }

    // Seul le propriétaire de la liste peut changer ce réglage (les listes gérées
    // par la famille ont un utilisateur fictif : cet appelant échoue donc déjà).
    if (member.user.uuid !== user.uuid) {
        return reply.status(403).send({ error: "Forbidden, only the list owner can change the priority ordering" });
    }

    const updated = await FamilyService.setPriorityEnabled(member, enabled);

    return reply.status(200).send({
        uuid: updated.uuid,
        priorityEnabled: updated.priorityEnabled !== false
    });
}

/**
 * Change l'image de profil d'un membre de la famille.
 * Règles :
 *  - un membre réel ne peut changer que sa propre image ;
 *  - un membre « liste gérée » (utilisateur fictif) peut être mis à jour par
 *    n'importe quel membre de la famille.
 * L'upload est fait séparément via POST /api/upload ; on stocke ici l'URL.
 */
export async function set_member_image(req: FastifyRequest<{
    Params: {
        memberUuid: string
    },
    Body: {
        image: string | null
    }
}>, reply: FastifyReply) {
    const {memberUuid} = req.params;
    const image = req.body?.image;
    const user = req.user;

    if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
    }

    // Accepte une URL de fichier déjà uploadée (/uploads/...) ou null (retrait).
    // La validation JSON coercive de Fastify (AJV) transforme null en "" et un
    // nombre en chaîne : on normalise "" en null et on exige le préfixe /uploads/.
    const normalized = image === "" ? null : image;
    if (normalized !== null && (typeof normalized !== 'string' || !/^\/uploads\/[A-Za-z0-9._-]+$/.test(normalized))) {
        return reply.status(400).send({ error: 'Bad parameter: image must be an uploaded file URL (/uploads/...) or null' });
    }

    const member = await FamilyService.getMemberOfFamilyByUuid(memberUuid);
    if (!member) {
        return reply.status(404).send({ error: 'Member not found' });
    }

    // L'appelant doit appartenir à la famille du membre.
    if (!member.family.isMember(user.uuid)) {
        return reply.status(403).send({ error: 'Forbidden' });
    }

    const isSelf = member.user.uuid === user.uuid;
    const isManagedMember = member.user.virtual === true;
    if (!isSelf && !isManagedMember) {
        return reply.status(403).send({ error: 'Forbidden, you can only change your own image' });
    }

    const updated = await FamilyService.setMemberImage(member, normalized);

    return reply.status(200).send({
        uuid: updated.uuid,
        image: updated.image ?? null
    });
}

export async function create_virtual_member(req: FastifyRequest<{
    Body: {
        familyId: string,
        username: string,
        email?: string
    }
}>, reply: FastifyReply) {
    const { familyId, username, email } = req.body;
    const user = req.user;
    if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
    }

    const family = await FamilyService.getFamilyById(familyId);
    if (!family) {
        return reply.status(404).send({ error: 'Family not found' });
    }

    if(!family.isMember(user.uuid)){
        return reply.status(403).send({ error: 'Forbidden' });
    }

    const result = await FamilyService.createVirtualMember(familyId, username, email);
    if (!result) {
        return reply.status(500).send({ error: 'Failed to create the member' });
    }

    return reply.status(200).send({
        family: { uuid: result.family.uuid, name: result.family.name },
        user: { uuid: result.user.uuid, email: result.user.email },
        member: { uuid: result.member.uuid, name: result.member.name }
    });
}
