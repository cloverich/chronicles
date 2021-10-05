import { PrismaClient } from "../../prisma/client";
import { RouterContext } from "@koa/router";
import { parser, stringifier } from "../../markdown";

// My first attempt at JSON schema for validating the document save request
// todo: clean-up, recycle validators. Research GraphQL o.0
// https://github.com/ajv-validator/ajv-formats
// https://ajv.js.org/api.html
import Ajv from "ajv";
import addFormats from "ajv-formats";
const ajv = addFormats(new Ajv({ coerceTypes: true }));

const saveDocumentSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    id: {
      type: "string",
      title: "id",
      minLength: 25,
    },
    title: {
      type: ["string", "null"],
      title: "title",
      // todo: max length? regex?
    },
    content: {
      type: "string",
      title: "content",
      minLength: 1,
      // todo: maxlength
    },
    createdAt: {
      type: "string",
      title: "createdAt",
      format: "date-time",
    },
    updatedAt: {
      type: "string",
      title: "updatedAt",
      format: "date-time",
    },
    journalId: {
      type: "string",
      title: "name",
      minLength: 25,
    },
  },
  additionalProperties: false,
  required: ["content", "journalId"],
};

const documentValidator = ajv.compile(saveDocumentSchema);

/**
 * DocumentsHandler validates API requests and hands them off to CRUD documents
 */
export class DocumentsHandler {
  private client: PrismaClient;

  constructor(client: PrismaClient) {
    this.client = client;
  }

  // documents
  findById = async (ctx: RouterContext) => {
    if (!ctx.params.id) {
      ctx.response.status = 400;
      ctx.response.body = {
        title: "Document id is required",
      };
    }

    const doc = await this.client.document2.findFirst({
      where: { id: ctx.params.id },
    });

    if (doc) {
      ctx.response.status = 200;
      ctx.response.body = doc;
    } else {
      ctx.response.status = 404;
      ctx.response.body = {
        title: "Document not found. Maybe you need to create it?",
      };
    }
  };

  search = async (ctx: RouterContext) => {
    const journals = ctx.request.body.journals;

    // todo: Pagination
    // https://www.prisma.io/docs/concepts/components/prisma-client/pagination
    let docs: any;
    if (journals && journals.length > 0) {
      // todo: validate journal names? What's the result if they are invalid?
      // no search results. Hrmph
      // todo: test -- search with invalid journal(s) returns no search results
      docs = await this.client.document2.findMany({
        where: {
          journalId: {
            in: journals,
          },
        },
        select: {
          id: true,
          createdAt: true,
          title: true,
          journalId: true,
        },
        orderBy: { createdAt: "desc" },
        // take: 100,
      });
    } else {
      docs = await this.client.document2.findMany({
        select: {
          id: true,
          createdAt: true,
          title: true, // todo: this comes out as [null] when empty. An array? WTF?
          journalId: true,
        },
        orderBy: { createdAt: "desc" },
        // take: 120,
      });
    }

    ctx.response.status = 200;
    ctx.response.body = {
      data: docs,
    };
  };

  // todo: error on unknkown properties. I was sending documentId instead of id
  // and it took a minute to figure it all out...
  save = async (ctx: RouterContext) => {
    // todo: unsure how to coerce empty string (in title) to null
    const body: any = { ...ctx.request.body };
    const isValid = documentValidator(body);

    if (!isValid) {
      console.log(documentValidator.errors);
      ctx.response.status = 400;
      ctx.response.body = {
        title: documentValidator.errors![0].message,
      };
      return;
    }

    if (body.id) {
      const doc = await this.client.document2.update({
        where: { id: body.id },
        data: body,
      });

      ctx.response.body = doc;
      ctx.response.status = 200;
    } else {
      const doc = await this.client.document2.create({
        data: body,
      });
      ctx.response.body = doc;
      ctx.response.status = 200;
    }
  };
}
