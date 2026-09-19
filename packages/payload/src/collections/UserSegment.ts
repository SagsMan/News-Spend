import type { CollectionConfig } from "payload";

const UserSegment: CollectionConfig = {
  slug: "user-segments",
  admin: {
    useAsTitle: "name",
    group: "Push Notifications",
  },
  access: {
    read: ({ req }) => req.user?.role === "super-admin",
    create: ({ req }) => req.user?.role === "super-admin",
    update: ({ req }) => req.user?.role === "super-admin",
    delete: ({ req }) => req.user?.role === "super-admin",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      admin: {
        description:
          "Name of the segment (e.g., Active Users, Premium Subscribers)",
      },
    },
    {
      name: "description",
      type: "textarea",
      admin: {
        description: "Description of this segment",
      },
    },
    {
      name: "criteria",
      type: "json",
      required: true,
      admin: {
        description:
          "JSON criteria for this segment (e.g., {lastActive: { equals: '7d'}, deviceType: { equals: 'android}})",
      },
    },
    {
      name: "userCount",
      admin: {
        description: "Number of users in this segment",
        readOnly: true,
      },
      type: "number",
      virtual: true,
      defaultValue: 0,
    },
    // {
    //   name: "createdBy",
    //   type: "relationship",
    //   relationTo: "admins",
    //   admin: {
    //     readOnly: true,
    //     description: "Admin who created this segment",
    //   },
    // },
  ],
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === "create" && !data.createdBy) {
          data.createdBy = req.user?.id;
        }
        return data;
      },
    ],
    // populate the userCount field
    afterRead: [
      ({ req, doc }) => {
        // const criteria = doc.
        // const userCount = await req.payload.count({
        //   collection: 'users',
        //   where: {
        //     id: {
        //       equals: doc.id,
        //     },
        //   },
        // })
        // doc.userCount = userCount.totalDocs
        return doc;
      },
    ],
  },
};

export default UserSegment;
