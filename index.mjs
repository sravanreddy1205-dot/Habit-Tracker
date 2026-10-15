import {
    DynamoDBClient,
    PutItemCommand,
    ScanCommand,
    DeleteItemCommand,
    UpdateItemCommand
  } from "@aws-sdk/client-dynamodb";
  
  const dynamo = new DynamoDBClient({
    region: "ap-south-1"
  });
  
  const TABLE_NAME = "HabitTracker";
  
  const COGNITO_REGION = "ap-south-1";
  const COGNITO_CLIENT_ID = "3qpvagall3t67077cr9lm8vf6l";
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": "http://127.0.0.1:5500",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "authorization,content-type"
  };
  
  
  // ============================================================
  // Helper: Response
  // ============================================================
  
  function response(statusCode, body) {
    return {
      statusCode,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    };
  }
  
  
  // ============================================================
  // Helper: Get today's date
  // ============================================================
  
  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }
  
  
  // ============================================================
  // Helper: Calculate current streak
  // ============================================================
  
  function calculateStreak(completionDates = []) {
  
    if (!completionDates || completionDates.length === 0) {
      return 0;
    }
  
    const dates = new Set(completionDates);
  
    let streak = 0;
  
    const currentDate = new Date();
  
    while (true) {
  
      const dateString = currentDate.toISOString().slice(0, 10);
  
      if (!dates.has(dateString)) {
        break;
      }
  
      streak++;
  
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    }
  
    return streak;
  }
  
  
  // ============================================================
  // Helper: Get user ID from Cognito JWT
  // ============================================================
  
  function getUserId(event) {
  
    const claims =
      event.requestContext?.authorizer?.jwt?.claims;
  
    const userId = claims?.sub;
  
    return userId || null;
  }
  
  
  // ============================================================
  // AUTH
  // ============================================================
  
  async function login(body) {
  
    const email = body.email;
    const password = body.password;
  
    if (!email || !password) {
      return response(400, {
        message: "Email and password are required"
      });
    }
  
    const cognitoUrl =
      `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;
  
    const authResponse = await fetch(cognitoUrl, {
      method: "POST",
  
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target":
          "AWSCognitoIdentityProviderService.InitiateAuth"
      },
  
      body: JSON.stringify({
        AuthFlow: "USER_PASSWORD_AUTH",
  
        ClientId: COGNITO_CLIENT_ID,
  
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      })
    });
  
    const data = await authResponse.json();
  
    if (!authResponse.ok) {
  
      return response(401, {
        message:
          data.message ||
          data.__type ||
          "Login failed"
      });
    }
  
    return response(200, {
      accessToken: data.AuthenticationResult?.AccessToken,
      idToken: data.AuthenticationResult?.IdToken,
      refreshToken: data.AuthenticationResult?.RefreshToken,
  
      expiresIn:
        data.AuthenticationResult?.ExpiresIn,
  
      tokenType:
        data.AuthenticationResult?.TokenType
    });
  }
  
  
  // ============================================================
  // GET HABITS
  // ============================================================
  
  async function getHabits(userId) {
  
    const result = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
  
        FilterExpression:
          "#userId = :userId",
  
        ExpressionAttributeNames: {
          "#userId": "userId"
        },
  
        ExpressionAttributeValues: {
          ":userId": {
            S: userId
          }
        }
      })
    );
  
    const habits = (result.Items || []).map(item => {
  
      const completionDates =
        item.completionDates?.SS || [];
  
      return {
        id: item.id?.S,
  
        userId: item.userId?.S,
  
        name: item.name?.S,
  
        status: item.status?.S || "pending",
  
        completionDates,
  
        streak: calculateStreak(completionDates)
      };
    });
  
    return response(200, habits);
  }
  
  
  // ============================================================
  // CREATE HABIT
  // ============================================================
  
  async function createHabit(body, userId) {
  
    const name = body.name?.trim();
  
    if (!name) {
      return response(400, {
        message: "Habit name is required"
      });
    }
  
    const id =
      `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
  
    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
  
        Item: {
  
          id: {
            S: id
          },
  
          userId: {
            S: userId
          },
  
          name: {
            S: name
          },
  
          status: {
            S: "pending"
          },
  
        
        }
      })
    );
  
    return response(201, {
  
      message: "Habit created successfully",
  
      habit: {
        id,
        userId,
        name,
        status: "pending",
        completionDates: [],
        streak: 0
      }
    });
  }
  
  
  // ============================================================
  // UPDATE HABIT
  // ============================================================
  
  async function updateHabit(body, userId) {
  
    const id = body.id;
  
    if (!id) {
      return response(400, {
        message: "Habit ID is required"
      });
    }
  
    const today = getToday();
  
    try {
  
      // --------------------------------------------------------
      // COMPLETE
      // --------------------------------------------------------
  
      if (body.status === "completed") {
  
        const existing = await dynamo.send(
          new ScanCommand({
            TableName: TABLE_NAME,
  
            FilterExpression:
              "id = :id AND #userId = :userId",
  
            ExpressionAttributeNames: {
              "#userId": "userId"
            },
  
            ExpressionAttributeValues: {
  
              ":id": {
                S: id
              },
  
              ":userId": {
                S: userId
              }
            }
          })
        );
  
        if (!existing.Items || existing.Items.length === 0) {
  
          return response(404, {
            message: "Habit not found"
          });
        }
  
        const item = existing.Items[0];
  
        let completionDates =
          item.completionDates?.SS || [];
  
        // Add today's date only once
        if (!completionDates.includes(today)) {
  
          completionDates.push(today);
        }
  
        await dynamo.send(
          new UpdateItemCommand({
  
            TableName: TABLE_NAME,
  
            Key: {
              id: {
                S: id
              }
            },
  
            UpdateExpression:
              "SET #status = :status, completionDates = :dates",
  
            ConditionExpression:
              "#userId = :userId",
  
            ExpressionAttributeNames: {
              "#status": "status",
              "#userId": "userId"
            },
  
            ExpressionAttributeValues: {
  
              ":status": {
                S: "completed"
              },
  
              ":dates": {
                SS: completionDates
              },
  
              ":userId": {
                S: userId
              }
            }
          })
        );
  
        return response(200, {
  
          message: "Habit completed",
  
          habit: {
            id,
            status: "completed",
            completionDates,
            streak:
              calculateStreak(completionDates)
          }
        });
      }
  
  
      // --------------------------------------------------------
      // UNDO
      // --------------------------------------------------------
  
      if (body.status === "pending") {
  
        const existing = await dynamo.send(
          new ScanCommand({
            TableName: TABLE_NAME,
  
            FilterExpression:
              "id = :id AND #userId = :userId",
  
            ExpressionAttributeNames: {
              "#userId": "userId"
            },
  
            ExpressionAttributeValues: {
  
              ":id": {
                S: id
              },
  
              ":userId": {
                S: userId
              }
            }
          })
        );
  
        if (!existing.Items || existing.Items.length === 0) {
  
          return response(404, {
            message: "Habit not found"
          });
        }
  
        const item = existing.Items[0];
  
        let completionDates =
          item.completionDates?.SS || [];
  
        // Remove today's completion
        completionDates =
          completionDates.filter(
            date => date !== today
          );
  
  
        // DynamoDB String Set cannot be empty.
        // If there are no dates left, remove the attribute.
        if (completionDates.length === 0) {
  
          await dynamo.send(
            new UpdateItemCommand({
  
              TableName: TABLE_NAME,
  
              Key: {
                id: {
                  S: id
                }
              },
  
              UpdateExpression:
                "SET #status = :status REMOVE completionDates",
  
              ConditionExpression:
                "#userId = :userId",
  
              ExpressionAttributeNames: {
                "#status": "status",
                "#userId": "userId"
              },
  
              ExpressionAttributeValues: {
  
                ":status": {
                  S: "pending"
                },
  
                ":userId": {
                  S: userId
                }
              }
            })
          );
  
        } else {
  
          await dynamo.send(
            new UpdateItemCommand({
  
              TableName: TABLE_NAME,
  
              Key: {
                id: {
                  S: id
                }
              },
  
              UpdateExpression:
                "SET #status = :status, completionDates = :dates",
  
              ConditionExpression:
                "#userId = :userId",
  
              ExpressionAttributeNames: {
                "#status": "status",
                "#userId": "userId"
              },
  
              ExpressionAttributeValues: {
  
                ":status": {
                  S: "pending"
                },
  
                ":dates": {
                  SS: completionDates
                },
  
                ":userId": {
                  S: userId
                }
              }
            })
          );
        }
  
        return response(200, {
  
          message: "Habit marked as pending",
  
          habit: {
            id,
            status: "pending",
            completionDates,
            streak:
              calculateStreak(completionDates)
          }
        });
      }
  
  
      return response(400, {
        message:
          "Status must be completed or pending"
      });
  
    } catch (error) {
  
      console.error("Update error:", error);
  
      if (
        error.name ===
        "ConditionalCheckFailedException"
      ) {
  
        return response(403, {
          message: "You do not own this habit"
        });
      }
  
      return response(500, {
        message: "Failed to update habit"
      });
    }
  }
  
  
  // ============================================================
  // DELETE HABIT
  // ============================================================
  
  async function deleteHabit(body, userId) {
  
    const id = body.id;
  
    if (!id) {
      return response(400, {
        message: "Habit ID is required"
      });
    }
  
    try {
  
      await dynamo.send(
        new DeleteItemCommand({
  
          TableName: TABLE_NAME,
  
          Key: {
            id: {
              S: id
            }
          },
  
          ConditionExpression:
            "#userId = :userId",
  
          ExpressionAttributeNames: {
            "#userId": "userId"
          },
  
          ExpressionAttributeValues: {
  
            ":userId": {
              S: userId
            }
          }
        })
      );
  
      return response(200, {
        message: "Habit deleted successfully"
      });
  
    } catch (error) {
  
      console.error("Delete error:", error);
  
      if (
        error.name ===
        "ConditionalCheckFailedException"
      ) {
  
        return response(403, {
          message: "You do not own this habit"
        });
      }
  
      return response(500, {
        message: "Failed to delete habit"
      });
    }
  }
  
  
  // ============================================================
  // MAIN HANDLER
  // ============================================================
  
  export const handler = async (event) => {
  
    console.log(
      "Received event:",
      JSON.stringify(event)
    );
  
    // ----------------------------------------------------------
    // OPTIONS
    // ----------------------------------------------------------
  
    if (event.requestContext?.http?.method === "OPTIONS") {
  
      return response(204, {});
    }
  
  
    const method =
      event.requestContext?.http?.method;
  
    const path =
      event.requestContext?.http?.path;
  
  
    // ----------------------------------------------------------
    // Parse body
    // ----------------------------------------------------------
  
    let body = {};
  
    try {
  
      if (event.body) {
        body = JSON.parse(event.body);
      }
  
    } catch (error) {
  
      return response(400, {
        message: "Invalid JSON body"
      });
    }
  
  
    // ----------------------------------------------------------
    // AUTH
    // ----------------------------------------------------------
  
    if (
      method === "POST" &&
      path.endsWith("/auth")
    ) {
  
      return await login(body);
    }
  
  
    // ----------------------------------------------------------
    // Get authenticated user
    // ----------------------------------------------------------
  
    const userId = getUserId(event);
  
    if (!userId) {
  
      return response(401, {
        message: "Unauthorized"
      });
    }
  
  
    // ----------------------------------------------------------
    // GET /habits
    // ----------------------------------------------------------
  
    if (
      method === "GET" &&
      path.endsWith("/habits")
    ) {
  
      return await getHabits(userId);
    }
  
  
    // ----------------------------------------------------------
    // POST /habits
    // ----------------------------------------------------------
  
    if (
      method === "POST" &&
      path.endsWith("/habits")
    ) {
  
      return await createHabit(
        body,
        userId
      );
    }
  
  
    // ----------------------------------------------------------
    // PUT /habits
    // ----------------------------------------------------------
  
    if (
      method === "PUT" &&
      path.endsWith("/habits")
    ) {
  
      return await updateHabit(
        body,
        userId
      );
    }
  
  
    // ----------------------------------------------------------
    // DELETE /habits
    // ----------------------------------------------------------
  
    if (
      method === "DELETE" &&
      path.endsWith("/habits")
    ) {
  
      return await deleteHabit(
        body,
        userId
      );
    }
  
  
    // ----------------------------------------------------------
    // Route not found
    // ----------------------------------------------------------
  
    return response(404, {
      message: "Route not found"
    });
  };