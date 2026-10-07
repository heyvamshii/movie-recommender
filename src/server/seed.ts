/**
 * Starting likes so "people like you" has someone to match from the first click.
 * user1 and user2 start empty for the live demo. supabase/schema.sql inserts the same rows
 * (a test keeps the two in sync).
 */
export const SEED_LIKES: Record<string, number[]> = {
  // superhero and sci-fi fan
  user3: [89745, 59315, 112852, 110102, 122920, 122912, 58559, 109487, 79132],
  // romantic comedy fan
  user4: [2671, 597, 6942, 1721, 8533, 539, 1307, 4246],
};
