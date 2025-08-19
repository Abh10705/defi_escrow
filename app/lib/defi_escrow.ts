/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/defi_escrow.json`.
 */
export type DefiEscrow = {
  "address": "BD7NH19PHYwgpDDcAY5JAgNWByeVDYwHbTV5vpZv8VYJ",
  "metadata": {
    "name": "defiEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelInvoice",
      "discriminator": [
        88,
        158,
        54,
        49,
        53,
        26,
        92,
        68
      ],
      "accounts": [
        {
          "name": "invoice",
          "writable": true
        },
        {
          "name": "business",
          "signer": true,
          "relations": [
            "invoice"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "claimDefault",
      "discriminator": [
        12,
        132,
        209,
        37,
        163,
        22,
        128,
        241
      ],
      "accounts": [
        {
          "name": "invoice",
          "writable": true
        },
        {
          "name": "investor",
          "signer": true,
          "relations": [
            "invoice"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeInvoice",
      "discriminator": [
        133,
        150,
        221,
        0,
        227,
        119,
        139,
        200
      ],
      "accounts": [
        {
          "name": "invoice",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  118,
                  111,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "business"
              }
            ]
          }
        },
        {
          "name": "business",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "dueDate",
          "type": "i64"
        }
      ]
    },
    {
      "name": "listInvoice",
      "discriminator": [
        14,
        197,
        8,
        166,
        231,
        10,
        164,
        231
      ],
      "accounts": [
        {
          "name": "invoice",
          "writable": true
        },
        {
          "name": "business",
          "signer": true,
          "relations": [
            "invoice"
          ]
        }
      ],
      "args": [
        {
          "name": "tokenMint",
          "type": "pubkey"
        },
        {
          "name": "salePrice",
          "type": "u64"
        }
      ]
    },
    {
      "name": "purchaseInvoice",
      "discriminator": [
        22,
        121,
        68,
        63,
        59,
        108,
        9,
        175
      ],
      "accounts": [
        {
          "name": "invoice",
          "writable": true
        },
        {
          "name": "investor",
          "writable": true,
          "signer": true
        },
        {
          "name": "investorTokenAccount",
          "writable": true
        },
        {
          "name": "businessTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "repayInvestorAndClose",
      "discriminator": [
        241,
        250,
        208,
        245,
        18,
        85,
        18,
        61
      ],
      "accounts": [
        {
          "name": "invoice",
          "writable": true
        },
        {
          "name": "business",
          "writable": true,
          "signer": true,
          "relations": [
            "invoice"
          ]
        },
        {
          "name": "investorTokenAccount",
          "writable": true
        },
        {
          "name": "businessTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "invoice",
      "discriminator": [
        51,
        194,
        250,
        114,
        6,
        104,
        18,
        164
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notListed",
      "msg": "Invoice is not listed for sale."
    },
    {
      "code": 6001,
      "name": "alreadySold",
      "msg": "Invoice has already been sold and cannot be cancelled."
    },
    {
      "code": 6002,
      "name": "notSold",
      "msg": "Invoice must be in the 'Sold' state to be repaid or defaulted."
    },
    {
      "code": 6003,
      "name": "invalidSalePrice",
      "msg": "Sale price must be less than the invoice amount."
    },
    {
      "code": 6004,
      "name": "notYetDue",
      "msg": "The invoice is not yet due for repayment."
    }
  ],
  "types": [
    {
      "name": "invoice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "business",
            "type": "pubkey"
          },
          {
            "name": "investor",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "salePrice",
            "type": "u64"
          },
          {
            "name": "dueDate",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "invoiceStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "invoiceStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "listed"
          },
          {
            "name": "sold"
          },
          {
            "name": "repaid"
          },
          {
            "name": "cancelled"
          },
          {
            "name": "defaulted"
          }
        ]
      }
    }
  ]
};
